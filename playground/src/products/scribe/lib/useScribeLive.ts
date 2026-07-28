import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Captures the built-in mic, converts it to 16 kHz mono PCM16 via an AudioWorklet,
 * streams it to the /live/scribe proxy (which forwards to Zoom Scribe live ASR with a
 * fresh JWT), and exposes the transcription as it arrives.
 */
export function useScribeLive() {
    const [status, setStatus] = useState<ScribeStatus>('idle')
    const [segments, setSegments] = useState<string[]>([])
    const [interim, setInterim] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [latencyMs, setLatencyMs] = useState<number | null>(null)
    const [events, setEvents] = useState<ScribeEventRecord[]>([])

    const wsRef = useRef<WebSocket | null>(null)
    const ctxRef = useRef<AudioContext | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const nodeRef = useRef<AudioWorkletNode | null>(null)
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const eventIdRef = useRef(0)
    const sessionIdRef = useRef(0)
    const mountedRef = useRef(true)

    const recordEvent = useCallback((body: string, type: string | null) => {
        const id = (eventIdRef.current += 1)
        const now = new Date()
        const time = now.toLocaleTimeString([], { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0')
        setEvents(prev => [{ id, time, type, body }, ...prev].slice(0, 300))
    }, [])

    const teardownAudio = useCallback(() => {
        try { nodeRef.current?.disconnect() } catch { /* ignore */ }
        try { sourceRef.current?.disconnect() } catch { /* ignore */ }
        try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch { /* ignore */ }
        try {
            const closing = ctxRef.current?.close()
            void closing?.catch(() => { /* ignore */ })
        } catch { /* ignore */ }
        nodeRef.current = null
        sourceRef.current = null
        streamRef.current = null
        ctxRef.current = null
    }, [])

    const stop = useCallback(() => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            setStatus('stopping')
            try { ws.send(JSON.stringify({ type: 'session.close' })) } catch { /* ignore */ }
            // Give the server a moment to flush any final transcript before closing.
            setTimeout(() => { try { ws.close() } catch { /* ignore */ } }, 1200)
        } else {
            // Invalidate getUserMedia/AudioWorklet setup that may still be awaiting,
            // and abort a WebSocket whose browser handshake has not completed.
            sessionIdRef.current += 1
            if (ws?.readyState === WebSocket.CONNECTING) {
                try { ws.close() } catch { /* ignore */ }
            }
            if (wsRef.current === ws) wsRef.current = null
            setStatus('idle')
        }
        teardownAudio()
    }, [teardownAudio])

    const start = useCallback(async (language: string) => {
        const sessionId = (sessionIdRef.current += 1)
        setError(null)
        setSegments([])
        setInterim('')
        setLatencyMs(null)
        setEvents([])
        setStatus('connecting')

        let stream: MediaStream | null = null
        let ctx: AudioContext | null = null
        let source: MediaStreamAudioSourceNode | null = null
        let node: AudioWorkletNode | null = null

        const isCurrent = () => mountedRef.current && sessionIdRef.current === sessionId
        const disposeLocalAudio = () => {
            try { node?.disconnect() } catch { /* ignore */ }
            try { source?.disconnect() } catch { /* ignore */ }
            try { stream?.getTracks().forEach(t => t.stop()) } catch { /* ignore */ }
            try {
                const closing = ctx?.close()
                void closing?.catch(() => { /* ignore */ })
            } catch { /* ignore */ }
            if (nodeRef.current === node) nodeRef.current = null
            if (sourceRef.current === source) sourceRef.current = null
            if (streamRef.current === stream) streamRef.current = null
            if (ctxRef.current === ctx) ctxRef.current = null
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            })
            if (!isCurrent()) {
                disposeLocalAudio()
                return
            }
            streamRef.current = stream

            const win = window as WindowWithWebkitAudio
            const AudioCtx = win.AudioContext ?? win.webkitAudioContext
            if (!AudioCtx) throw new Error('AudioContext is not supported in this browser.')
            ctx = new AudioCtx({ sampleRate: 16000 })
            ctxRef.current = ctx
            if (ctx.state === 'suspended') await ctx.resume()
            if (!isCurrent()) {
                disposeLocalAudio()
                return
            }

            await ctx.audioWorklet.addModule('/pcm-worklet.js')
            if (!isCurrent()) {
                disposeLocalAudio()
                return
            }

            source = ctx.createMediaStreamSource(stream)
            sourceRef.current = source
            node = new AudioWorkletNode(ctx, 'pcm-processor')
            nodeRef.current = node
            source.connect(node)
            node.connect(ctx.destination) // keep the graph pulling; output is silent

            const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/live/scribe`
            const ws = new WebSocket(wsUrl)
            ws.binaryType = 'arraybuffer'
            wsRef.current = ws

            node.port.onmessage = (e) => {
                const sock = wsRef.current
                if (sock && sock.readyState === WebSocket.OPEN) sock.send(e.data)
            }

            ws.onopen = () => {
                if (!isCurrent() || wsRef.current !== ws) {
                    ws.close()
                    return
                }
                ws.send(JSON.stringify({
                    type: 'session.update',
                    input_audio_format: 'pcm16',
                    turn_detection: { threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 350, min_pause_duration_ms: 100 },
                    language,
                }))
                // Stay "connecting" until the relay confirms Zoom is connected (relay.ready).
            }

            ws.onmessage = async (ev) => {
                if (!isCurrent() || wsRef.current !== ws) return
                let text: string
                if (typeof ev.data === 'string') text = ev.data
                else if (ev.data instanceof ArrayBuffer) text = new TextDecoder().decode(new Uint8Array(ev.data))
                else if (ev.data instanceof Blob) text = await ev.data.text()
                else text = String(ev.data ?? '')

                let event: ScribeWsEvent
                try { event = JSON.parse(text) as ScribeWsEvent } catch { recordEvent(text, null); return }
                const type = typeof event.type === 'string' ? event.type : null

                if (type === 'relay.ready') { setStatus('recording'); return }

                // Don't clutter the panel with audio/speech start & stop markers.
                if (!(type && /(started|stopped)$/i.test(type))) recordEvent(JSON.stringify(event, null, 2), type)

                if (event.type === 'transcription.completed') {
                    const t = String(event.transcript ?? '').trim()
                    if (t) setSegments(prev => [...prev, t])
                    setInterim('')
                    if (typeof event.transcription_latency_ms === 'number') setLatencyMs(event.transcription_latency_ms)
                } else if (event.type === 'error') {
                    setError(event.error?.message ?? JSON.stringify(event))
                } else {
                    const t = event.transcript ?? event.text ?? event.delta
                    if (typeof t === 'string' && t) setInterim(t)
                }
            }

            ws.onerror = () => {
                if (isCurrent() && wsRef.current === ws) {
                    setError('WebSocket error — check the server logs, token, and endpoint.')
                }
            }
            ws.onclose = () => {
                if (!isCurrent() || wsRef.current !== ws) return
                wsRef.current = null
                setStatus(s => (s === 'error' ? s : 'idle'))
                teardownAudio()
            }
        } catch (err) {
            if (!isCurrent()) {
                disposeLocalAudio()
                return
            }
            const message = err instanceof Error ? err.message : String(err)
            setError(message.includes('Permission') || message.includes('denied')
                ? 'Microphone permission denied. Allow mic access and try again.'
                : message)
            setStatus('error')
            teardownAudio()
        }
    }, [teardownAudio, recordEvent])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            sessionIdRef.current += 1

            const ws = wsRef.current
            wsRef.current = null
            if (ws?.readyState === WebSocket.OPEN) {
                try { ws.send(JSON.stringify({ type: 'session.close' })) } catch { /* ignore */ }
            }
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                try { ws.close() } catch { /* ignore */ }
            }
            teardownAudio()
        }
    }, [teardownAudio])

    const clear = useCallback(() => {
        setSegments([])
        setInterim('')
        setLatencyMs(null)
        setEvents([])
    }, [])

    return { status, segments, interim, error, latencyMs, events, start, stop, clear }
}

export type ScribeStatus = 'idle' | 'connecting' | 'recording' | 'stopping' | 'error'

export type ScribeEventRecord = {
    id: number
    time: string
    type: string | null
    body: string
}

type ScribeWsEvent = {
    type?: string
    transcript?: string
    text?: string
    delta?: string
    transcription_latency_ms?: number
    error?: { message?: string }
}

type WindowWithWebkitAudio = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
