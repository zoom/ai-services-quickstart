import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventRecord } from '../../../components/EventLog'
import { eventTime } from '../../../lib/utils'
import { fromBase64, PcmPlayer } from '../../../lib/pcm'
import { audioAppend, sessionUpdate, type InterpreterEvent, type InterpreterOptions } from './protocol'

type Status = 'idle' | 'connecting' | 'live' | 'draining' | 'completed' | 'error'
type Resources = {
    ws?: WebSocket
    context?: AudioContext
    player?: PcmPlayer
    stream?: MediaStream
    source?: MediaStreamAudioSourceNode
    node?: AudioWorkletNode
    timer?: ReturnType<typeof setTimeout>
    configured: boolean
    ending: boolean
    closeSent: boolean
    completed: boolean
}

function stopCapture(resources: Resources) {
    if (resources.node) resources.node.port.onmessage = null
    resources.node?.disconnect()
    resources.source?.disconnect()
    resources.stream?.getTracks().forEach(track => track.stop())
    resources.node = undefined
    resources.source = undefined
    resources.stream = undefined
}

function dispose(resources: Resources) {
    clearTimeout(resources.timer)
    stopCapture(resources)
    resources.ws?.close()
    resources.player?.stop()
    void resources.context?.close().catch(() => {})
}

export function useInterpreter() {
    const [status, setStatus] = useState<Status>('idle')
    const [sourceText, setSourceText] = useState('')
    const [translatedText, setTranslatedText] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [events, setEvents] = useState<EventRecord[]>([])
    const [session, setSession] = useState<InterpreterEvent['session'] | null>(null)
    const currentRef = useRef<Resources | null>(null)
    const eventIdRef = useRef(0)

    const cancel = useCallback(() => {
        const resources = currentRef.current
        currentRef.current = null
        if (resources) dispose(resources)
        setStatus('idle')
    }, [])

    const start = useCallback(async (options: InterpreterOptions) => {
        if (currentRef.current) dispose(currentRef.current)
        const resources: Resources = { configured: false, ending: false, closeSent: false, completed: false }
        currentRef.current = resources
        const isCurrent = () => currentRef.current === resources
        const fail = (message: string) => {
            if (!isCurrent()) return
            currentRef.current = null
            dispose(resources)
            setError(message)
            setStatus('error')
        }
        setStatus('connecting'); setError(null); setSourceText(''); setTranslatedText(''); setEvents([]); setSession(null)
        try {
            const update = sessionUpdate(options)
            const context = new AudioContext({ sampleRate: 16000 })
            resources.context = context
            resources.player = new PcmPlayer(context, 16000)
            await context.resume()
            if (!isCurrent()) return
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
            if (!isCurrent()) { stream.getTracks().forEach(track => track.stop()); return }
            resources.stream = stream
            await context.audioWorklet.addModule('/pcm-worklet.js')
            if (!isCurrent()) return
            const node = new AudioWorkletNode(context, 'pcm-processor')
            const source = context.createMediaStreamSource(stream)
            resources.node = node
            resources.source = source
            source.connect(node)
            node.connect(context.destination)
            const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/live/interpreter`)
            resources.ws = ws
            resources.timer = setTimeout(() => fail('Interpreter configuration timed out. Check the server, credentials, and account language-pair access.'), 20000)
            const send = (event: unknown) => {
                if (!isCurrent() || ws.readyState !== WebSocket.OPEN) throw new Error('The Interpreter connection is closed.')
                ws.send(JSON.stringify(event))
            }
            ws.onopen = () => { if (isCurrent()) send(update) }
            node.port.onmessage = (event: MessageEvent<ArrayBuffer | { type: string }>) => {
                if (!isCurrent() || !resources.configured || resources.closeSent) return
                try {
                    if (event.data instanceof ArrayBuffer) {
                        if (ws.bufferedAmount > 1024 * 1024) throw new Error('The connection cannot keep up with microphone audio. Start a new session on a faster connection.')
                        send(audioAppend(event.data))
                    } else if (event.data.type === 'flushed' && resources.ending) {
                        resources.closeSent = true
                        stopCapture(resources)
                        send({ type: 'session.close' })
                    }
                } catch (cause) { fail(cause instanceof Error ? cause.message : String(cause)) }
            }
            ws.onmessage = message => {
                if (!isCurrent()) return
                try {
                    const event = JSON.parse(String(message.data)) as InterpreterEvent
                    if (!event || typeof event.type !== 'string') throw new Error('Received an invalid Interpreter event.')
                    if (event.type === 'relay.ready') return
                    if (!event.type.endsWith('.delta')) {
                        setEvents(previous => [{ id: ++eventIdRef.current, time: eventTime(), type: event.type, body: JSON.stringify(event, null, 2) }, ...previous].slice(0, 200))
                    }
                    switch (event.type) {
                        case 'session.created': setSession(event.session); break
                        case 'session.updated':
                            clearTimeout(resources.timer)
                            resources.configured = true
                            setSession(event.session)
                            setStatus('live')
                            break
                        case 'session.input_transcript.delta':
                            if (typeof event.delta === 'string') setSourceText(text => text + event.delta)
                            break
                        case 'session.output_transcript.delta':
                            if (typeof event.delta === 'string') setTranslatedText(text => text + event.delta)
                            break
                        case 'session.output_audio.delta':
                            if (typeof event.delta === 'string') resources.player?.append(fromBase64(event.delta))
                            break
                        case 'error':
                            fail(`${event.error?.message ?? 'Interpreter returned an error.'}${event.error?.param ? ` Field: ${event.error.param}.` : ''}${event.error?.code ? ` (${event.error.code})` : ''} Correct the settings or account access, then start a new session.`)
                            break
                        case 'session.closed':
                            clearTimeout(resources.timer)
                            resources.configured = false
                            stopCapture(resources)
                            if (event.reason !== 'completed') { fail(`Translation ended: ${event.reason ?? 'unknown reason'}. Completion was not confirmed.`); break }
                            resources.player?.finish()
                            resources.completed = true
                            setStatus('completed')
                            ws.close()
                            break
                    }
                } catch (cause) { fail(cause instanceof Error ? cause.message : String(cause)) }
            }
            ws.onerror = () => fail('Interpreter WebSocket failed. Check the server logs, credentials, and account access.')
            ws.onclose = () => {
                if (!isCurrent()) return
                clearTimeout(resources.timer)
                stopCapture(resources)
                if (!resources.completed) fail('Connection closed before translation completion was confirmed. Received output may be partial.')
            }
        } catch (cause) { fail(cause instanceof Error ? cause.message : String(cause)) }
    }, [])

    const finish = useCallback(() => {
        const resources = currentRef.current
        if (!resources?.configured || resources.ending) return
        resources.ending = true
        setStatus('draining')
        // Flush the final partial microphone frame before session.close. Keep receiving output.
        resources.node?.port.postMessage({ type: 'flush' })
        resources.timer = setTimeout(() => {
            if (currentRef.current !== resources) return
            currentRef.current = null
            dispose(resources)
            setError('Timed out waiting for translation completion. Received output may be partial.')
            setStatus('error')
        }, 30000)
    }, [])

    useEffect(() => () => {
        const resources = currentRef.current
        currentRef.current = null
        if (resources) dispose(resources)
    }, [])

    return { status, sourceText, translatedText, error, events, session, start, finish, cancel }
}
