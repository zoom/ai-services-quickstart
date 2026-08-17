import { useEffect, useRef, useState } from 'react'
import { Card, SectionHeading, Field } from '../../../components/ui'
import { inputCls } from '../../../lib/constants'
import { useScribeLive, type ScribeStatus } from '../lib/useScribeLive'

const STATUS_LABEL: Record<ScribeStatus, string> = {
    idle: 'Ready',
    connecting: 'Connecting',
    recording: 'Listening',
    stopping: 'Wrapping up',
    error: 'Error',
}

// 44 deterministic bar heights (px) — a fixed "resting" silhouette so the idle
// waveform looks intentional, not random. sin-based so neighbours vary smoothly.
const BARS = Array.from({ length: 44 }, (_, i) => {
    const h = 5 + Math.abs(Math.sin(i * 1.35) * Math.cos(i * 0.6)) * 22
    return { rest: Math.round(h), delay: (i % 11) * 0.07, dur: 0.6 + (i % 5) * 0.12 }
})

function Waveform({ live }: { live: boolean }) {
    return (
        <div className="flex items-center justify-center gap-[3px] h-16" aria-hidden>
            {BARS.map((b, i) => (
                <span
                    key={i}
                    className="w-[3px] rounded-full bg-gradient-to-t from-zoom-blue/40 to-zoom-blue"
                    style={
                        live
                            ? { height: '28px', animation: `barPulse ${b.dur}s ease-in-out ${b.delay}s infinite alternate` }
                            : { height: `${b.rest}px`, opacity: 0.28, transition: 'height .3s ease, opacity .3s ease' }
                    }
                />
            ))}
        </div>
    )
}

export function LiveTab() {
    const [language, setLanguage] = useState('en-US')
    const [diarize, setDiarize] = useState(false)
    const { status, segments, interim, error, latencyMs, events, start, stop, clear } = useScribeLive()

    const live = status === 'recording'
    const connecting = status === 'connecting'
    const active = live || connecting || status === 'stopping'

    const transcriptRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const el = transcriptRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [segments, interim])

    const statusTone = status === 'error' ? 'text-red-500' : live ? 'text-zoom-blue' : 'text-gray-400'
    const dot = status === 'error' ? 'bg-red-500' : live ? 'bg-zoom-blue' : connecting || status === 'stopping' ? 'bg-amber-400' : 'bg-gray-300'

    return (
        <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:items-start gap-5">
            <div className="flex flex-col gap-5">
                {/* Stage: the live-audio centerpiece */}
                <Card className="relative overflow-hidden">
                    {/* soft radial glow that warms up while listening */}
                    <div
                        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
                        style={{
                            opacity: live ? 1 : 0,
                            background: 'radial-gradient(120% 80% at 50% -10%, rgba(11,92,255,0.10), transparent 60%)',
                        }}
                    />

                    <div className="relative flex items-center justify-between">
                        <SectionHeading title="Live Transcription" />
                        <span className={`flex items-center gap-2 text-xs font-semibold tracking-wide ${statusTone}`}>
                            <span className="relative flex h-2 w-2">
                                {live && <span className="absolute inline-flex h-full w-full rounded-full bg-zoom-blue opacity-60" style={{ animation: 'ringPulse 1.4s ease-out infinite' }} />}
                                <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
                            </span>
                            {STATUS_LABEL[status]}
                            {latencyMs != null && <span className="text-gray-400 font-normal tabular-nums">· {latencyMs}ms</span>}
                        </span>
                    </div>

                    <div className="relative mt-2 mb-6">
                        <Waveform live={live} />
                    </div>

                    <div className="relative flex items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={live || connecting ? stop : () => start(language, diarize)}
                            disabled={status === 'stopping'}
                            aria-label={live || connecting ? 'Stop transcription' : 'Start transcription'}
                            className={[
                                'group relative flex items-center justify-center h-16 w-16 rounded-full transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-zoom-blue/30',
                                status === 'stopping' ? 'bg-gray-300 cursor-not-allowed' : '',
                                live || connecting ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30' : '',
                                !active ? 'bg-zoom-blue hover:bg-zoom-blue-hover shadow-lg shadow-zoom-blue/30' : '',
                            ].join(' ')}
                        >
                            {(live || connecting) && (
                                <span className="absolute inset-0 rounded-full bg-red-500/40" style={{ animation: 'ringPulse 1.6s ease-out infinite' }} />
                            )}
                            {live || connecting ? (
                                <span className="relative h-5 w-5 rounded-[4px] bg-white" />
                            ) : (
                                // mic glyph
                                <svg className="relative h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="3" width="6" height="11" rx="3" />
                                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <p className="relative mt-4 text-center text-xs text-gray-400">
                        {connecting ? 'Opening the stream to Zoom Scribe…'
                            : status === 'stopping' ? 'Flushing the final transcript…'
                                : live ? 'Speak — completed segments appear as they arrive.'
                                    : 'Tap the mic to stream your microphone in real time.'}
                    </p>

                    {error && (
                        <p className="relative mt-3 text-center text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg py-2 px-3">{error}</p>
                    )}
                </Card>

                <Card>
                    <div className="flex items-end justify-between gap-4">
                        <div className="flex-1 max-w-xs">
                            <Field label="Language" hint="BCP-47 — en-US, es-ES, fr-FR, ja-JP…">
                                <input className={inputCls} value={language} disabled={active} onChange={e => setLanguage(e.target.value)} placeholder="en-US" />
                            </Field>
                        </div>
                        <button
                            type="button"
                            role="checkbox"
                            aria-checked={diarize}
                            disabled={active}
                            onClick={() => setDiarize(v => !v)}
                            className={[
                                'mb-0.5 flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-zoom-blue/25 disabled:opacity-40 disabled:cursor-not-allowed',
                                diarize
                                    ? 'border-zoom-blue bg-zoom-blue/5 shadow-sm'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                            ].join(' ')}
                        >
                            <span className={[
                                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                diarize ? 'border-zoom-blue bg-zoom-blue' : 'border-gray-300',
                            ].join(' ')}>
                                {diarize && (
                                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6 9 17l-5-5" />
                                    </svg>
                                )}
                            </span>
                            <span className={diarize ? 'text-xs font-semibold text-gray-800' : 'text-xs font-medium text-gray-700'}>
                                Speaker diarization
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={clear}
                            disabled={active || (segments.length === 0 && !interim && events.length === 0)}
                            className="mb-0.5 px-3.5 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </Card>

                {/* Transcript: editorial, auto-scrolling */}
                <Card className="flex flex-col">
                    <SectionHeading title="Transcript" />
                    <div
                        ref={transcriptRef}
                        className="min-h-44 max-h-[42vh] overflow-auto text-[15px] leading-8 text-gray-800 wrap-break-word scroll-smooth"
                    >
                        {segments.length === 0 && !interim ? (
                            <span className="text-gray-300 select-none italic">Completed segments will appear here as you speak…</span>
                        ) : (
                            <p className="[text-wrap:pretty] whitespace-pre-wrap">
                                {segments.map((s, i) => (
                                    <span key={i} style={{ animation: 'riseIn .35s ease both' }}>
                                        {s.speaker && s.speaker !== segments[i - 1]?.speaker && (
                                            <span className="font-sans font-semibold text-zoom-blue">{i > 0 && '\n'}{s.speaker}: </span>
                                        )}
                                        {s.text}{' '}
                                    </span>
                                ))}
                                {interim && (
                                    <span className="text-zoom-blue/70" style={{ animation: 'breathe 1.6s ease-in-out infinite' }}>{interim}</span>
                                )}
                            </p>
                        )}
                    </div>
                    {segments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 tabular-nums">
                            {segments.length} segment{segments.length === 1 ? '' : 's'}
                        </div>
                    )}
                </Card>
            </div>

            {/* Raw event stream */}
            <div className="lg:sticky lg:top-20">
                {/* Bound the whole panel to the space under the sticky offset so it never runs
                    off-screen; only the list scrolls, the header stays pinned. */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col max-h-[calc(100dvh-7rem)]">
                    <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-zoom-panel">
                        <span className="text-xs font-semibold text-gray-500 tracking-wide">Scribe events</span>
                        {events.length > 0 && <span className="text-[11px] text-gray-400 tabular-nums">{events.length}</span>}
                    </div>
                    <div className="flex-1 min-h-44 overflow-y-auto p-3 bg-zoom-surface flex flex-col gap-2">
                        {events.length === 0 ? (
                            <span className="text-xs text-gray-300 select-none p-1">Raw Scribe events stream in here…</span>
                        ) : (
                            events.map(ev => (
                                <div key={ev.id} className="shrink-0 rounded-lg border border-gray-200/70 bg-white overflow-hidden" style={{ animation: 'riseIn .25s ease both' }}>
                                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
                                        <span className="text-[10px] font-mono text-gray-400 tabular-nums shrink-0">{ev.time}</span>
                                        {ev.type && <span className="text-[10px] font-semibold text-zoom-blue font-mono truncate">{ev.type}</span>}
                                    </div>
                                    <pre className="px-3 py-2 text-[11px] leading-relaxed font-mono whitespace-pre-wrap wrap-break-word text-gray-600 max-h-40 overflow-auto">{ev.body}</pre>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
