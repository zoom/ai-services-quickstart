import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventRecord } from '../../../components/EventLog'
import { eventTime } from '../../../lib/utils'
import { SAMPLE_RATE, cancellationTarget, interruptionEvents, playedAudioMs, responseFailure, responseIdentity, sessionUpdate, shouldFollowUp, type AudioChunk, type VoiceAgentOptions } from './protocol'
export type { VoiceAgentOptions } from './protocol'

export type VoiceAgentStatus = 'idle' | 'connecting' | 'live' | 'error'
export type ConversationLine = { id: string; role: 'user' | 'agent'; text: string; interrupted?: boolean }

type PlaybackItem = { id: string; responseId: string; contentIndex: number; chunks: AudioChunk[]; duration: number }

function runTool(name: string, args: string) {
    if (name !== 'get_current_time') return JSON.stringify({ error: `Unknown tool: ${name}` })
    try {
        const { time_zone } = JSON.parse(args) as { time_zone: string }
        return JSON.stringify({ time_zone, now: new Date().toLocaleString('en-US', { timeZone: time_zone }) })
    } catch (err) { return JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }
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

export function useVoiceAgent() {
    const [status, setStatus] = useState<VoiceAgentStatus>('idle')
    const [lines, setLines] = useState<ConversationLine[]>([])
    const [events, setEvents] = useState<EventRecord[]>([])
    const [error, setError] = useState<string | null>(null)
    const [effectiveConfig, setEffectiveConfig] = useState<unknown>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const ctxRef = useRef<AudioContext | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const nodeRef = useRef<AudioWorkletNode | null>(null)
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const playingRef = useRef<AudioBufferSourceNode[]>([])
    const playheadRef = useRef(0)
    const playbackRef = useRef(new Map<string, PlaybackItem>())
    const eventIdRef = useRef(0)
    const generationRef = useRef(0)
    const mountedRef = useRef(true)

    const stopPlayback = useCallback(() => {
        playingRef.current.forEach(s => { try { s.stop() } catch { /* already ended */ } })
        playingRef.current = []
        playheadRef.current = 0
        playbackRef.current.clear()
    }, [])

    const teardown = useCallback(() => {
        stopPlayback()
        if (nodeRef.current) nodeRef.current.port.onmessage = null
        try { nodeRef.current?.disconnect() } catch { /* ignore */ }
        try { sourceRef.current?.disconnect() } catch { /* ignore */ }
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        nodeRef.current = null
        sourceRef.current = null
        void ctxRef.current?.close().catch(() => { /* ignore */ })
        ctxRef.current = null
    }, [stopPlayback])

    const stop = useCallback(() => {
        generationRef.current += 1
        const ws = wsRef.current
        wsRef.current = null
        ws?.close(1000)
        teardown()
        setStatus('idle')
    }, [teardown])

    const start = useCallback(async (options: VoiceAgentOptions) => {
        const generation = ++generationRef.current
        const isCurrent = () => mountedRef.current && generationRef.current === generation
        wsRef.current?.close()
        wsRef.current = null
        teardown()
        setError(null)
        setEffectiveConfig(null)
        setLines([])
        setEvents([])
        setStatus('connecting')
        let stream: MediaStream | null = null
        let ctx: AudioContext | null = null
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
            if (!isCurrent()) { stream.getTracks().forEach(t => t.stop()); return }
            streamRef.current = stream
            ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
            ctxRef.current = ctx
            if (ctx.state === 'suspended') await ctx.resume()
            if (!isCurrent()) { void ctx.close().catch(() => {}); return }
            await ctx.audioWorklet.addModule('/pcm-worklet.js')
            if (!isCurrent()) { void ctx.close().catch(() => {}); return }
            const node = new AudioWorkletNode(ctx, 'pcm-processor')
            const source = ctx.createMediaStreamSource(stream)
            nodeRef.current = node
            sourceRef.current = source
            source.connect(node)
            node.connect(ctx.destination)
            const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/live/voice-agent`)
            wsRef.current = ws
            let configured = false
            let activeResponse: string | null = null
            const itemResponses = new Map<string, string>()
            const lastOutputItems = new Map<string, string>()
            const interrupted = new Set<string>()
            const toolResults = new Set<string>()
            const sentToolCalls = new Set<string>()
            let toolContinuations = 0
            const send = (event: unknown) => { if (isCurrent() && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event)) }
            node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
                if (isCurrent() && configured) send({ type: 'input_audio_buffer.append', audio: toBase64(e.data) })
            }
            ws.onmessage = (msg) => {
                if (!isCurrent() || wsRef.current !== ws) return
                let envelope
                try { envelope = JSON.parse(String(msg.data)) } catch { setError('Received an invalid WebSocket event.'); return }
                const event = envelope.payload ?? envelope
                if (typeof event.type !== 'string' || event.type === 'relay.ready') return
                if (!event.type.endsWith('.delta')) {
                    setEvents(prev => [{ id: ++eventIdRef.current, time: eventTime(), type: event.type, body: JSON.stringify(event, null, 2) }, ...prev].slice(0, 300))
                }
                const responseId = responseIdentity(event, itemResponses)
                if (responseId && typeof event.item_id === 'string') itemResponses.set(event.item_id, responseId)
                const suppressed = responseId !== null && interrupted.has(responseId)
                switch (event.type) {
                    case 'session.created': send(sessionUpdate(options)); break
                    case 'session.updated':
                        configured = true
                        setEffectiveConfig(event.session ?? event)
                        setError(null)
                        setStatus('live')
                        break
                    case 'response.created':
                        if (!responseId) { setError('Response started without an ID; ignoring malformed event.'); break }
                        activeResponse = responseId
                        break
                    case 'response.output_item.added':
                        if (responseId && typeof event.item?.id === 'string') {
                            itemResponses.set(event.item.id, responseId)
                            lastOutputItems.set(responseId, event.item.id)
                        }
                        break
                    case 'input_audio_buffer.speech_started': {
                        toolContinuations = 0
                        const now = ctxRef.current?.currentTime ?? 0
                        const controls: unknown[] = interruptionEvents(cancellationTarget(activeResponse, interrupted), null)
                        if (activeResponse) { interrupted.add(activeResponse); toolResults.delete(activeResponse) }
                        for (const playback of playbackRef.current.values()) {
                            const heard = playedAudioMs(playback.chunks, now)
                            if (heard >= Math.floor(playback.duration * 1000) && playback.responseId !== activeResponse) continue
                            interrupted.add(playback.responseId)
                            controls.push(...interruptionEvents(null, { id: playback.id, contentIndex: playback.contentIndex, playedMs: heard }))
                        }
                        // Stop immediately; cancellation and truncation keep server history in sync.
                        stopPlayback()
                        setLines(prev => prev.map(line => line.role === 'agent' && interrupted.has(line.id.slice('agent-'.length)) ? { ...line, interrupted: true } : line))
                        controls.forEach(send)
                        break
                    }
                    case 'conversation.item.input_audio_transcription.completed':
                        setLines(prev => [...prev, { id: `user-${event.item_id}`, role: 'user', text: event.transcript ?? '' }])
                        break
                    case 'response.output_audio_transcript.delta':
                        if (suppressed) break
                        setLines(prev => {
                            const id = `agent-${responseId ?? event.item_id}`
                            const i = prev.findIndex(l => l.id === id)
                            if (i < 0) return [...prev, { id, role: 'agent', text: event.delta ?? '' }]
                            return prev.map((line, index) => index === i ? { ...line, text: line.text + (event.delta ?? '') } : line)
                        })
                        break
                    case 'response.output_audio.delta': {
                        const audioCtx = ctxRef.current
                        const itemId = event.item_id ?? (responseId ? lastOutputItems.get(responseId) : undefined)
                        if (suppressed || !audioCtx || !itemId || !responseId || typeof event.delta !== 'string') break
                        const samples = pcm16ToFloat32(event.delta)
                        const buffer = audioCtx.createBuffer(1, samples.length, SAMPLE_RATE)
                        buffer.copyToChannel(samples, 0)
                        const source = audioCtx.createBufferSource()
                        source.buffer = buffer
                        source.connect(audioCtx.destination)
                        const at = Math.max(audioCtx.currentTime, playheadRef.current)
                        source.start(at)
                        playheadRef.current = at + buffer.duration
                        for (const [id, previous] of playbackRef.current) {
                            if (id !== itemId && playedAudioMs(previous.chunks, audioCtx.currentTime) >= Math.floor(previous.duration * 1000)) playbackRef.current.delete(id)
                        }
                        if (!playbackRef.current.has(itemId)) playbackRef.current.set(itemId, { id: itemId, responseId, contentIndex: event.content_index ?? 0, chunks: [], duration: 0 })
                        const playback = playbackRef.current.get(itemId)!
                        playback.chunks.push({ startsAt: at, duration: buffer.duration, offset: playback.duration })
                        playback.duration += buffer.duration
                        playingRef.current.push(source)
                        source.onended = () => { playingRef.current = playingRef.current.filter(s => s !== source) }
                        break
                    }
                    case 'response.function_call_arguments.done':
                        if (suppressed || !options.functionCalling || options.toolChoice === 'none' || !event.call_id || !responseId || sentToolCalls.has(event.call_id)) break
                        sentToolCalls.add(event.call_id)
                        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: event.call_id, output: runTool(event.name, event.arguments) } })
                        toolResults.add(responseId)
                        break
                    case 'response.done': {
                        if (!responseId) { setError('Response ended without an ID; ignoring malformed event.'); break }
                        const response = event.response ?? event
                        const failure = responseFailure(response)
                        if (failure && !suppressed) setError(failure)
                        if (responseId === activeResponse) activeResponse = null
                        if (responseId && shouldFollowUp(response.status, toolResults.has(responseId), suppressed)) {
                            // Required tool choice also applies to the next response; cap continuations
                            // so a repeated tool call cannot create an endless browser loop.
                            if (toolContinuations < 1) { toolContinuations += 1; send({ type: 'response.create' }) }
                            else setError('Tool output was returned. Automatic continuation paused after a repeated tool call; choose Auto or ask another question.')
                        }
                        if (responseId) toolResults.delete(responseId)
                        break
                    }
                    case 'error':
                        setError(event.error?.message ?? JSON.stringify(event))
                        if (event.error?.fatal) { configured = false; setStatus('error'); ws.close(); teardown() }
                        break
                }
            }
            ws.onerror = () => { if (isCurrent()) setError('WebSocket error — check the server logs and credentials.') }
            ws.onclose = () => {
                if (!isCurrent() || wsRef.current !== ws) return
                wsRef.current = null
                teardown()
                setStatus(s => s === 'error' ? s : 'idle')
            }
        } catch (err) {
            if (!isCurrent()) { stream?.getTracks().forEach(t => t.stop()); if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {}); return }
            setError(err instanceof Error ? err.message : String(err))
            setStatus('error')
            teardown()
        }
    }, [teardown, stopPlayback])

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false; generationRef.current += 1; wsRef.current?.close(); wsRef.current = null; teardown() }
    }, [teardown])

    return { status, lines, events, error, effectiveConfig, start, stop }
}
