import { useState } from 'react'
import { Card, ErrorNote, Field, SectionHeading, SubmitButton, ToggleRow } from '../../../components/ui'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { inputCls, selectCls } from '../../../lib/constants'
import { AudioUploadZone } from '../../scribe/components/AudioUploadZone'
import { useAudioUpload } from '../../../lib/useAudioUpload'

const TEMPLATES = ['one_on_one', 'stand_up', 'brainstorm', 'project_update', 'discussion', 'q_a', 'customer_success', 'user_feedback', 'lecture_summary', 'next_steps']

type StreamEvent = { event: string; data: string }

// Parse complete SSE events out of `buffer`; returns them plus the unparsed remainder.
function parseSse(buffer: string): [StreamEvent[], string] {
    const blocks = buffer.split(/\r?\n\r?\n/)
    const rest = blocks.pop() ?? ''
    const events = blocks.filter(Boolean).map(block => {
        const lines = block.split(/\r?\n/)
        const event = lines.find(l => l.startsWith('event:'))?.slice(6).trim() ?? 'message'
        const data = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n')
        return { event, data }
    })
    return [events, rest]
}

export function SummarizeTab() {
    const upload = useAudioUpload()
    const [language, setLanguage] = useState('en-US')
    const [summaryLanguage, setSummaryLanguage] = useState('en-US')
    const [diarization, setDiarization] = useState(true)
    const [citations, setCitations] = useState(true)
    const [profanityFilter, setProfanityFilter] = useState(false)
    const [removeSentiment, setRemoveSentiment] = useState(false)
    const [template, setTemplate] = useState('') // '' = automatic, 'custom' = custom_template
    const [customTemplate, setCustomTemplate] = useState('')

    const [busy, setBusy] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [summary, setSummary] = useState('')
    const [events, setEvents] = useState<StreamEvent[]>([])
    const [error, setError] = useState<string | null>(null)

    const handleEvent = ({ event, data }: StreamEvent) => {
        // Summary updates repeat the full summary, so keep a short preview and cap the list.
        setEvents(prev => [...prev, { event, data: data.slice(0, 300) }].slice(-300))
        let json: Record<string, unknown>
        try { json = JSON.parse(data) } catch { return }
        if (event === 'transcribe_complete') {
            const t = json.transcript as { result?: { text_display?: string } } | undefined
            setTranscript(t?.result?.text_display ?? '')
        } else if (event === 'error') {
            setError(String(json.error ?? data))
        } else if (typeof json.summary === 'string') {
            setSummary(json.summary) // each update carries the full summary so far
        } else if (typeof json.summary_result === 'string') {
            setSummary(json.summary_result)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!upload.file) return
        setBusy(true)
        setTranscript('')
        setSummary('')
        setEvents([])
        setError(null)

        const summaryConfig = {
            language: summaryLanguage,
            citations,
            should_remove_sentiment: removeSentiment,
            ...(template === 'custom'
                ? { custom_template: customTemplate, enable_dynamic_template: false }
                : template
                    ? { template_id: template, enable_dynamic_template: false }
                    : { enable_dynamic_template: true }),
        }
        const form = new FormData()
        form.append('file', upload.file)
        form.append('config', JSON.stringify({
            transcribe: { language, diarization, profanity_filter: profanityFilter },
            summary: summaryConfig,
        }))

        try {
            const res = await fetch('/api/speech-summarization', { method: 'POST', body: form })
            if (!res.ok || !res.body) throw new Error(await res.text() || res.statusText)
            const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
            let buffer = ''
            for (;;) {
                const { value, done } = await reader.read()
                if (done) break
                const [parsed, rest] = parseSse(buffer + value)
                buffer = rest
                parsed.forEach(handleEvent)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="speech-summarization-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Recording" />
                    <AudioUploadZone {...upload.zoneProps} />
                    <p className="mt-2 text-xs text-gray-500">WAV, MP3, M4A, WebM, or MP4 — up to 50 MB and 2 hours.</p>
                </Card>

                <Card>
                    <SectionHeading title="Summary Config" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Speech language" hint="Language spoken in the recording">
                            <input className={inputCls} value={language} onChange={e => setLanguage(e.target.value)} />
                        </Field>
                        <Field label="Summary language" hint="Can differ from the speech language">
                            <input className={inputCls} value={summaryLanguage} onChange={e => setSummaryLanguage(e.target.value)} />
                        </Field>
                        <Field label="Template" hint="Automatic detects the meeting type">
                            <select className={selectCls} value={template} onChange={e => setTemplate(e.target.value)}>
                                <option value="">Automatic</option>
                                {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                                <option value="custom">Custom…</option>
                            </select>
                        </Field>
                        <ToggleRow label="Speaker diarization" checked={diarization} onChange={setDiarization} />
                        <ToggleRow label="Citations" hint="Footnote markers such as [^1]" checked={citations} onChange={setCitations} />
                        <ToggleRow label="Profanity filter" checked={profanityFilter} onChange={setProfanityFilter} />
                        <ToggleRow label="Remove sentiment" hint="Drop emotional language" checked={removeSentiment} onChange={setRemoveSentiment} />
                    </div>
                    {template === 'custom' && (
                        <textarea
                            className={inputCls + ' mt-4 resize-none'}
                            rows={3}
                            value={customTemplate}
                            onChange={e => setCustomTemplate(e.target.value)}
                            placeholder="Use Markdown headings Decisions and Action Items…"
                        />
                    )}
                </Card>
            </form>

            <div className="lg:sticky lg:top-20 flex flex-col gap-4 min-w-0">
                <SubmitButton form="speech-summarization-form" busy={busy} disabled={!upload.file} label="Summarize" busyLabel="Streaming..." />
                {error && <ErrorNote>{error}</ErrorNote>}
                <Card>
                    <SectionHeading title="Summary" />
                    {summary ? <MarkdownContent>{summary}</MarkdownContent> : <span className="text-xs text-gray-300">The streamed summary appears here…</span>}
                </Card>
                <Card>
                    <SectionHeading title="Transcript" />
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{transcript || <span className="text-gray-300">Appears when transcription completes…</span>}</p>
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
