import { useEffect, useRef, useState } from 'react'
import { Card, ErrorNote, Field, LimitedTextarea, SectionHeading } from '../../../components/ui'
import { inputCls, selectCls } from '../../../lib/constants'
import { PcmPlayer, pcmWav } from '../../../lib/pcm'
import { TTS_MAX_BYTES, TTS_MAX_CHARACTERS, ttsInputSchema, ttsVoices } from '../../../../../src/config/tts'

export function FastTab() {
    const [input, setInput] = useState('Hello everyone, welcome to Zoom AI Services.')
    const [voice, setVoice] = useState('jenna')
    const [speed, setSpeed] = useState(1)
    const [volume, setVolume] = useState(1)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [trackingId, setTrackingId] = useState<string | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [bytes, setBytes] = useState(0)
    const requestRef = useRef<AbortController | null>(null)
    const contextRef = useRef<AudioContext | null>(null)
    const playerRef = useRef<PcmPlayer | null>(null)
    const body = JSON.stringify({ input, voice, speed, volume, response_format: 'pcm_44100' })
    const bodyBytes = new TextEncoder().encode(body).length
    const characters = Array.from(input).length
    const valid = ttsInputSchema.safeParse(JSON.parse(body)).success && bodyBytes <= TTS_MAX_BYTES

    useEffect(() => () => {
        requestRef.current?.abort()
        playerRef.current?.stop()
        void contextRef.current?.close().catch(() => {})
    }, [])
    useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

    const synthesize = async (event: React.SubmitEvent) => {
        event.preventDefault()
        if (!valid || busy) return
        requestRef.current?.abort()
        playerRef.current?.stop()
        void contextRef.current?.close().catch(() => {})
        const controller = new AbortController()
        requestRef.current = controller
        setBusy(true); setError(null); setAudioUrl(null); setTrackingId(null); setBytes(0)
        try {
            const context = new AudioContext({ sampleRate: 44100 })
            contextRef.current = context
            await context.resume()
            if (controller.signal.aborted) return
            const player = new PcmPlayer(context, 44100)
            playerRef.current = player
            const response = await fetch('/api/tts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal,
            })
            if (controller.signal.aborted) return
            setTrackingId(response.headers.get('x-zm-trackingid'))
            if (!response.ok) {
                const detail = await response.text()
                const retryAfter = response.headers.get('retry-after')
                throw new Error(`Synthesis failed (HTTP ${response.status}). ${detail}${retryAfter ? ` Retry-After: ${retryAfter}.` : ''}`)
            }
            if (!response.body) throw new Error('No audio stream was returned.')
            const reader = response.body.getReader()
            const chunks: Uint8Array[] = []
            let received = 0
            while (true) {
                const { value, done } = await reader.read()
                if (controller.signal.aborted) return
                if (done) break
                chunks.push(value)
                received += value.length
                player.append(value)
                setBytes(received)
            }
            player.finish()
            if (!received) throw new Error('The audio stream was empty.')
            setAudioUrl(URL.createObjectURL(pcmWav(chunks, 44100)))
        } catch (cause) {
            if (controller.signal.aborted) return
            playerRef.current?.stop()
            void contextRef.current?.close().catch(() => {})
            setError(`${cause instanceof Error ? cause.message : String(cause)} Partial audio was discarded.`)
        } finally {
            if (requestRef.current === controller && !controller.signal.aborted) { requestRef.current = null; setBusy(false) }
        }
    }

    const cancel = () => {
        requestRef.current?.abort(); requestRef.current = null
        playerRef.current?.stop(); void contextRef.current?.close().catch(() => {})
        setBusy(false); setError('Synthesis cancelled. Partial audio was discarded.')
    }

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="tts-fast-form" onSubmit={synthesize} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Text to Speak" />
                    <fieldset disabled={busy}>
                        <LimitedTextarea value={input} onChange={setInput} rows={8} placeholder="Enter English text to synthesize…" used={characters} max={TTS_MAX_CHARACTERS} warnAt={200} overMessage="Text exceeds the 4,000 Unicode code point limit." />
                    </fieldset>
                    <p className="mt-2 text-xs text-gray-500">US English plain text · {bodyBytes.toLocaleString()} / 32,768 request bytes</p>
                    {bodyBytes > TTS_MAX_BYTES && <ErrorNote>Encoded request exceeds 32 KiB. Reduce the text.</ErrorNote>}
                </Card>
                <Card>
                    <SectionHeading title="Speech Config" />
                    <fieldset disabled={busy} className="grid sm:grid-cols-3 gap-4 disabled:opacity-60">
                        <Field label="Voice" hint="Ten public voices">
                            <select aria-label="Voice" className={selectCls} value={voice} onChange={e => setVoice(e.target.value)}>
                                {ttsVoices.map(value => <option key={value}>{value}</option>)}
                            </select>
                        </Field>
                        <Field label="Speed" hint="0.5× to 2×">
                            <input aria-label="Speed" className={inputCls} type="number" min={0.5} max={2} step={0.1} value={speed} onChange={e => setSpeed(e.target.valueAsNumber)} />
                        </Field>
                        <Field label="Volume" hint="Greater than 0, up to 10×">
                            <input aria-label="Volume" className={inputCls} type="number" min={0.01} max={10} step="any" value={volume} onChange={e => setVolume(e.target.valueAsNumber)} />
                        </Field>
                    </fieldset>
                </Card>
            </form>
            <div className="flex flex-col gap-4 mt-5 lg:mt-0 lg:sticky lg:top-20">
                <div className="flex gap-3">
                    <button type="submit" form="tts-fast-form" disabled={busy || !valid} className="px-6 py-2.5 rounded-lg bg-zoom-blue text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Synthesizing…' : '▶ Synthesize speech'}</button>
                    {busy && <button type="button" onClick={cancel} className="text-sm text-red-600">Cancel</button>}
                    {!busy && bytes > 0 && <button type="button" onClick={() => playerRef.current?.stop()} className="text-sm text-gray-500">Stop playback</button>}
                </div>
                <Card>
                    <SectionHeading title="Synthesized Speech" />
                    <p role="status" className="text-sm text-gray-500">{busy ? `Streaming and playing… ${(bytes / 88200).toFixed(1)} seconds received.` : audioUrl ? 'Synthesis complete. Replay or download your audio.' : 'Audio plays as it arrives. Completed audio appears here.'}</p>
                    {audioUrl && <><audio controls src={audioUrl} className="mt-4 w-full" /><a href={audioUrl} download="speech.wav" className="inline-block mt-3 text-sm text-zoom-blue">Download WAV</a></>}
                    <p className="mt-3 text-xs text-gray-400">44.1 kHz · 16-bit PCM · Mono</p>
                    {trackingId && <p className="mt-2 text-xs text-gray-500 break-all">Tracking ID: {trackingId}</p>}
                    {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
                </Card>
            </div>
        </div>
    )
}
