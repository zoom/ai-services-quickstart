import { useEffect, useRef, useState } from 'react'
import { Card, ErrorNote, Field, SectionHeading, SubmitButton, ToggleRow } from '../../../components/ui'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { inputCls, selectCls } from '../../../lib/constants'
import { AudioUploadZone } from '../../scribe/components/AudioUploadZone'
import { useAudioUpload } from '../../../lib/useAudioUpload'

import { speechUploadPolicy } from '../../../../../src/config/uploads'
import { initialSpeechState, reduceSpeechEvent, finishSpeechStream, parseSse, withCitations, type StreamEvent, type SpeechStreamState } from '../lib/stream'

const TEMPLATES = ['one_on_one', 'stand_up', 'brainstorm', 'project_update', 'discussion', 'q_a', 'customer_success', 'user_feedback', 'lecture_summary', 'next_steps']

export function SummarizeTab() {
    const upload = useAudioUpload()
    const [language, setLanguage] = useState('en-US')
    const [summaryLanguage, setSummaryLanguage] = useState('en-US')
    const [diarization, setDiarization] = useState(true)
    const [citations, setCitations] = useState(true)
    const [summaryLength, setSummaryLength] = useState<'short' | 'long'>('short')
    const [profanityFilter, setProfanityFilter] = useState(false)
    const [removeSentiment, setRemoveSentiment] = useState(false)
    const [template, setTemplate] = useState('') // '' = automatic, 'custom' = custom_template
    const [customTemplate, setCustomTemplate] = useState('## Decisions\n- \n\n## Action Items\n- ')

    const [busy, setBusy] = useState(false)
    const [stream, setStream] = useState(initialSpeechState)
    const [events, setEvents] = useState<StreamEvent[]>([])
    const abortRef = useRef<AbortController | null>(null)
    const requestRef = useRef(0)
    useEffect(() => () => { requestRef.current += 1; abortRef.current?.abort() }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!upload.file || (template === 'custom' && !customTemplate.trim())) return
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        const requestId = ++requestRef.current
        let current: SpeechStreamState = { ...initialSpeechState(), status: 'transcribing' }
        const update = () => { if (requestRef.current === requestId) setStream(current) }
        setBusy(true)
        update()
        setEvents([])

        const summaryConfig = {
            language: summaryLanguage,
            summary_length: summaryLength,
            citations,
            should_remove_sentiment: removeSentiment,
            ...(template === 'custom'
                ? { custom_template: customTemplate, enable_dynamic_template: false }
                : template
                    ? { template_id: template, enable_dynamic_template: false }
                    : { enable_dynamic_template: true }),
        }
        const form = new FormData()
        form.append('config', JSON.stringify({
            transcribe: { language, diarization, profanity_filter: profanityFilter },
            summary: summaryConfig,
        }))
        form.append('file', upload.file)

        try {
            const res = await fetch('/api/speech-summarization', { method: 'POST', body: form, signal: controller.signal })
            if (!res.ok || !res.body) throw new Error(await res.text() || res.statusText)
            const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
            let buffer = ''
            for (;;) {
                const { value, done } = await reader.read()
                if (done) break
                const [parsed, rest] = parseSse(buffer + value)
                buffer = rest
                for (const event of parsed) {
                    if (requestRef.current !== requestId) return
                    setEvents(previous => [...previous, { ...event, data: event.data.slice(0, 300) }].slice(-300))
                    current = reduceSpeechEvent(current, event)
                    update()
                }
                if (current.done || current.status === 'failed') { await reader.cancel(); break }
            }
            current = finishSpeechStream(current, buffer)
            update()
        } catch (err) {
            current = controller.signal.aborted
                ? { ...current, status: 'cancelled', error: 'Request cancelled. Partial results are shown below.' }
                : { ...current, status: 'failed', error: err instanceof Error ? err.message : String(err) }
            update()
        } finally {
            if (requestRef.current === requestId) { setBusy(false); abortRef.current = null }
        }
    }

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="speech-summarization-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Recording" />
                    <AudioUploadZone {...upload.zoneProps} policy={speechUploadPolicy} />
                </Card>

                <Card>
                    <SectionHeading title="Summary Config" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Speech language" hint="BCP-47 language code spoken in the recording">
                            <input required className={inputCls} value={language} onChange={e => setLanguage(e.target.value)} />
                        </Field>
                        <Field label="Summary language" hint="BCP-47 output language; can differ from speech">
                            <input required className={inputCls} value={summaryLanguage} onChange={e => setSummaryLanguage(e.target.value)} />
                        </Field>
                        <Field label="Template" hint="Automatic detects the meeting type">
                            <select className={selectCls} value={template} onChange={e => setTemplate(e.target.value)}>
                                <option value="">Automatic</option>
                                {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                                <option value="custom">Custom…</option>
                            </select>
                        </Field>
                        <Field label="Summary length"><select className={selectCls} value={summaryLength} onChange={e => setSummaryLength(e.target.value as 'short' | 'long')}><option value="short">Short</option><option value="long">Long</option></select></Field>
                        <ToggleRow label="Speaker diarization" checked={diarization} onChange={setDiarization} />
                        <ToggleRow label="Citations" hint="Footnote markers such as [^1]" checked={citations} onChange={setCitations} />
                        <ToggleRow label="Profanity filter" checked={profanityFilter} onChange={setProfanityFilter} />
                        <ToggleRow label="Remove sentiment" hint="Drop emotional language" checked={removeSentiment} onChange={setRemoveSentiment} />
                    </div>
                    {template === 'custom' && (
                        <textarea
                            className={inputCls + ' mt-4 resize-none'}
                            required
                            rows={6}
                            value={customTemplate}
                            onChange={e => setCustomTemplate(e.target.value)}
                            placeholder={'## Decisions\n- \n\n## Action Items\n- '}
                        />
                    )}
                </Card>
            </form>

            <div className="lg:sticky lg:top-20 flex flex-col gap-4 min-w-0">
                <SubmitButton form="speech-summarization-form" busy={busy} disabled={!upload.file || (template === 'custom' && !customTemplate.trim())} label="Summarize" busyLabel="Streaming..." />
                {busy && <button type="button" className="text-sm text-red-600" onClick={() => abortRef.current?.abort()}>Cancel request</button>}
                <p role="status" className="text-xs text-gray-500">Status: {stream.status}</p>
                {stream.error && <ErrorNote>{stream.error}</ErrorNote>}
                <Card>
                    <SectionHeading title="Summary" />
                    {stream.summary ? <MarkdownContent>{withCitations(stream.summary, stream.citations)}</MarkdownContent> : <span className="text-xs text-gray-300">The streamed summary appears here…</span>}
                </Card>
                <Card>
                    <SectionHeading title="Transcript" />
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{stream.transcript || <span className="text-gray-300">Appears when transcription completes…</span>}</p>
                </Card>
                <Card>
                    <SectionHeading title={`Events (${events.length})`} />
                    <div className="max-h-60 overflow-auto space-y-1 text-[11px] font-mono">
                        {events.map((ev, i) => <div key={i} className="truncate" title={ev.data}><span className="text-zoom-blue">{ev.event}</span> {ev.data}</div>)}
                    </div>
                </Card>
            </div>
        </div>
    )
}
