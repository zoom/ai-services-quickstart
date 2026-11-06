import { useState } from 'react'
import { EventLog } from '../../../components/EventLog'
import { Card, ErrorNote, Field, SectionHeading, ToggleRow } from '../../../components/ui'
import { selectCls } from '../../../lib/constants'
import { LANGUAGES, voicesForLanguage, type InterpreterOptions } from '../lib/protocol'
import { useInterpreter } from '../lib/useInterpreter'

export function LiveTab() {
    const [options, setOptions] = useState<InterpreterOptions>({ source: 'en-US', target: 'es-ES', voice: 'jenna', transcription: true })
    const { status, sourceText, translatedText, error, events, session, start, finish, cancel } = useInterpreter()
    const active = status === 'connecting' || status === 'live' || status === 'draining'
    const set = (patch: Partial<InterpreterOptions>) => setOptions(previous => {
        const next = { ...previous, ...patch }
        const voices = voicesForLanguage(next.target)
        if (!voices.includes(next.voice)) next.voice = voices[0]
        return next
    })

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <div className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Live Interpreter" />
                    <fieldset disabled={active} className="grid sm:grid-cols-3 gap-4 disabled:opacity-60">
                        <Field label="Source language" hint="Language you will speak">
                            <select aria-label="Source language" className={selectCls} value={options.source} onChange={e => set({ source: e.target.value })}>
                                {LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </Field>
                        <Field label="Target language" hint="Language for text and speech">
                            <select aria-label="Target language" className={selectCls} value={options.target} onChange={e => set({ target: e.target.value })}>
                                {LANGUAGES.map(([value, label]) => <option key={value} value={value} disabled={value === options.source}>{label}</option>)}
                            </select>
                        </Field>
                        <Field label="Voice" hint={options.target === 'ja-JP' ? 'Three voices support Japanese' : 'Nine voices available'}>
                            <select aria-label="Interpreter voice" className={selectCls} value={options.voice} onChange={e => set({ voice: e.target.value })}>
                                {voicesForLanguage(options.target).map(value => <option key={value}>{value}</option>)}
                            </select>
                        </Field>
                        <div className="sm:col-span-3"><ToggleRow label="Source transcript" hint="Also display what you say in the source language" checked={options.transcription} onChange={transcription => set({ transcription })} /></div>
                    </fieldset>
                    <p className="mt-4 text-xs text-gray-500">Language-pair availability depends on your account and translation direction. Text and speech are always produced. Use headphones to keep translated speech out of your microphone.</p>
                    <div className="mt-5 flex items-center gap-3 flex-wrap">
                        {!active && <button type="button" disabled={options.source === options.target} onClick={() => void start(options)} className="px-6 py-2.5 rounded-lg bg-zoom-blue text-white text-sm font-semibold disabled:opacity-50">● Start interpreting</button>}
                        {status === 'live' && <button type="button" onClick={finish} className="px-6 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold">■ Finish input</button>}
                        {active && <button type="button" onClick={cancel} className="text-sm text-gray-500">Cancel session</button>}
                        <span role="status" className="text-xs text-gray-500">{status === 'connecting' ? 'Connecting and configuring…' : status === 'live' ? 'Listening and translating…' : status === 'draining' ? 'Finishing translation. Remaining speech will continue playing…' : status === 'completed' ? 'Translation complete. Queued speech will finish playing.' : 'Uses your microphone and speakers.'}</span>
                    </div>
                    {options.source === options.target && <div className="mt-3"><ErrorNote>Choose different source and target languages.</ErrorNote></div>}
                    {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
                    {session && <details className="mt-4 text-xs text-gray-500">
                        <summary className="cursor-pointer font-semibold">Session configuration</summary>
                        {session.expires_at && <p className="mt-2">Expires: {new Date(session.expires_at * 1000).toLocaleString()}</p>}
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(session, null, 2)}</pre>
                    </details>}
                </Card>
                {options.transcription && <Card>
                    <SectionHeading title="Source Transcript" />
                    <p className="min-h-24 max-h-64 overflow-auto text-sm text-gray-700 whitespace-pre-wrap" dir="auto">{sourceText || 'Your speech appears here…'}</p>
                </Card>}
                <Card>
                    <SectionHeading title="Translation" />
                    <p className="min-h-32 max-h-80 overflow-auto text-sm text-zoom-blue whitespace-pre-wrap" dir="auto">{translatedText || 'Translated text appears here while translated speech plays…'}</p>
                    <p className="mt-3 text-xs text-gray-400">16 kHz · 16-bit PCM · Mono</p>
                </Card>
            </div>
            <EventLog title="Interpreter events (deltas hidden)" events={events} empty="Session events appear here…" />
        </div>
    )
}
