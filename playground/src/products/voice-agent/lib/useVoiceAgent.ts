import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventRecord } from '../../../components/EventLog'
import { eventTime } from '../../../lib/utils'

export type VoiceAgentStatus = 'idle' | 'connecting' | 'live' | 'error'
export type ConversationLine = { id: string; role: 'user' | 'agent'; text: string }

const SAMPLE_RATE = 16000 // Voice Agent output is 16 kHz only; input uses the same rate.

// Turn detection, barge-in, speed, noise reduction, and history truncation use server defaults
// and aren't configurable in the listen/think/speak session format.
export type VoiceAgentOptions = {
    voice: string
    instructions: string
    phrases: string // comma-separated vocabulary phrases for transcription
    functionCalling: boolean
    reasoningEffort: '' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' // '' omits reasoning
}

// Demo tool the agent can call; the browser runs it and returns the result.
const TOOLS = [{
    type: 'function',
    name: 'get_current_time',
    description: 'Get the current date and time for an IANA time zone, such as America/Los_Angeles.',
    parameters: {
        type: 'object',
        properties: { time_zone: { type: 'string', description: 'IANA time zone name' } },
        required: ['time_zone'],
    },
}]

function runTool(name: string, args: string) {
    if (name !== 'get_current_time') return JSON.stringify({ error: `Unknown tool: ${name}` })
    try {
        const { time_zone } = JSON.parse(args) as { time_zone: string }
        return JSON.stringify({ time_zone, now: new Date().toLocaleString('en-US', { timeZone: time_zone }) })
    } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
    }
}

function toBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(binary)
}

function pcm16ToFloat32(base64: string) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1)
    return Float32Array.from(pcm, s => s / 0x8000)
}

/**
 * Streams the mic to the /live/voice-agent relay as Base64 PCM16 in input_audio_buffer.append
 * events, plays the agent's PCM16 audio deltas, and keeps a running conversation transcript.
 */
export function useVoiceAgent() {
    const [status, setStatus] = useState<VoiceAgentStatus>('idle')
    const [lines, setLines] = useState<ConversationLine[]>([])
    const [events, setEvents] = useState<EventRecord[]>([])
    const [error, setError] = useState<string | null>(null)

    const wsRef = useRef<WebSocket | null>(null)
    const ctxRef = useRef<AudioContext | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const playingRef = useRef<AudioBufferSourceNode[]>([])
    const playheadRef = useRef(0)
    const eventIdRef = useRef(0)

    const stopPlayback = () => {
        playingRef.current.forEach(s => { try { s.stop() } catch { /* already ended */ } })
        playingRef.current = []
        playheadRef.current = 0
    }

    const play = (base64: string) => {
        const ctx = ctxRef.current
        if (!ctx) return
        const samples = pcm16ToFloat32(base64)
        const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE)
        buffer.copyToChannel(samples, 0)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        const at = Math.max(ctx.currentTime, playheadRef.current)
        source.start(at)
        playheadRef.current = at + buffer.duration
        playingRef.current.push(source)
        source.onended = () => { playingRef.current = playingRef.current.filter(s => s !== source) }
    }

    // Append a delta to the agent line for this response, creating it on the first delta.
    const appendAgent = (id: string, delta: string) => setLines(prev => {
        const i = prev.findIndex(l => l.id === id)
        if (i === -1) return [...prev, { id, role: 'agent', text: delta }]
        const next = [...prev]
        next[i] = { ...next[i], text: next[i].text + delta }
        return next
    })

    const teardown = useCallback(() => {
        stopPlayback()
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        void ctxRef.current?.close().catch(() => { /* ignore */ })
        ctxRef.current = null
    }, [])

    const stop = useCallback(() => {
        wsRef.current?.close(1000)
        wsRef.current = null
        teardown()
        setStatus('idle')
    }, [teardown])

    const start = useCallback(async (options: VoiceAgentOptions) => {
        const { voice, instructions, phrases, functionCalling, reasoningEffort } = options
        const vocabulary = phrases.split(',').map(p => p.trim()).filter(Boolean)
        setError(null)
        setLines([])
        setEvents([])
        setStatus('connecting')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
            streamRef.current = stream
            const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
            ctxRef.current = ctx
            await ctx.audioWorklet.addModule('/pcm-worklet.js')
            const node = new AudioWorkletNode(ctx, 'pcm-processor')
            ctx.createMediaStreamSource(stream).connect(node)
            node.connect(ctx.destination) // keep the graph pulling; the worklet outputs silence

            const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/live/voice-agent`)
            wsRef.current = ws
            let configured = false
            let followUp = false // a tool result was sent; ask for the next response after response.done

            // Mic audio is sent only after the session configuration is accepted.
            node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
                if (configured && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(e.data) }))
                }
            }

            ws.onmessage = (msg) => {
                const envelope = JSON.parse(String(msg.data))
                const event = envelope.payload ?? envelope // server events are wrapped in `payload`
                if (event.type === 'relay.ready') return

                // Skip per-chunk deltas (audio and transcript) so the log doesn't re-render on every token.
                if (!event.type.endsWith('.delta')) {
                    setEvents(prev => [{ id: ++eventIdRef.current, time: eventTime(), type: event.type, body: JSON.stringify(event, null, 2) }, ...prev].slice(0, 300))
                }

                switch (event.type) {
                    case 'session.created':
                        // The first client event must be session.update.
                        ws.send(JSON.stringify({
                            type: 'session.update',
                            session: {
                                type: 'realtime',
                                listen: {
                                    format: { type: 'pcm16', rate: SAMPLE_RATE },
                                    transcription: { language: 'en', ...(vocabulary.length > 0 && { vocabulary: { phrases: vocabulary } }) },
                                },
                                think: {
                                    provider: { type: 'zoom', model: 'gemma-4' },
                                    instructions,
                                    ...(functionCalling && { tools: TOOLS, tool_choice: 'auto' }),
                                    ...(reasoningEffort && { reasoning: { effort: reasoningEffort } }),
                                },
                                speak: { format: { type: 'pcm16' }, voice },
                            },
                        }))
                        break
                    case 'session.updated':
                        configured = true
                        setStatus('live')
                        break
                    case 'input_audio_buffer.speech_started':
                        stopPlayback() // barge-in: the user interrupted the agent
                        break
                    case 'conversation.item.input_audio_transcription.completed':
                        setLines(prev => [...prev, { id: `user-${event.item_id}`, role: 'user', text: event.transcript ?? '' }])
                        break
                    case 'response.output_audio_transcript.delta':
                        appendAgent(`agent-${event.response_id ?? event.item_id}`, event.delta ?? '')
                        break
                    case 'response.output_audio.delta':
                        play(event.delta)
                        break
                    case 'response.function_call_arguments.done':
                        ws.send(JSON.stringify({
                            type: 'conversation.item.create',
                            item: { type: 'function_call_output', call_id: event.call_id, output: runTool(event.name, event.arguments) },
                        }))
                        followUp = true
                        break
                    case 'response.done':
                        // Only one response can be active, so request the follow-up after this one ends.
                        if (followUp) {
                            followUp = false
                            ws.send(JSON.stringify({ type: 'response.create' }))
                        }
                        break
                    case 'error':
                        // Validation errors are nonfatal; the session stays open.
                        setError(event.error?.message ?? JSON.stringify(event))
                        break
                }
            }
            ws.onerror = () => setError('WebSocket error — check the server logs and credentials.')
            ws.onclose = () => {
                if (wsRef.current !== ws) return
                wsRef.current = null
                teardown()
                setStatus(s => (s === 'error' ? s : 'idle'))
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setStatus('error')
            teardown()
        }
    }, [teardown])

    useEffect(() => () => { wsRef.current?.close(); teardown() }, [teardown])

    return { status, lines, events, error, start, stop }
}
