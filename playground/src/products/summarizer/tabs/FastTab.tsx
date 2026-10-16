import { useState } from 'react'
import { JsonResult } from '../../../components/JsonResult'
import { Card, LimitedTextarea, SectionHeading, SubmitButton } from '../../../components/ui'
import { trpc } from '../../../lib/trpc'
import { SummarizerConfigForm } from '../components/SummarizerConfigForm'
import { SummarizerResult } from '../components/SummarizerResult'
import { MAX_TEXT_BYTES, defaultSummarizerConfig, type SummarizerConfig } from '../lib/constants'

const encoder = new TextEncoder()

export function FastTab() {
    const [text, setText] = useState('')
    const [config, setConfig] = useState<SummarizerConfig>(defaultSummarizerConfig)

    const summarizeMutation = trpc.summarizer.summarize.useMutation()

    const byteLength = encoder.encode(text).length
    const canSubmit = text.trim().length > 0 && byteLength <= MAX_TEXT_BYTES

    const busy = summarizeMutation.isPending
    const error = summarizeMutation.error?.message
    const response = summarizeMutation.data ?? (error ? { error } : null)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        summarizeMutation.mutate({ input: { text }, config })
    }

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="summarizer-fast-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Conversation Transcript" />
                    <LimitedTextarea
                        rows={12}
                        value={text}
                        onChange={setText}
                        placeholder="Paste a meeting transcript, call transcript, chat conversation, or speaker-attributed dialogue here..."
                        used={byteLength}
                        max={MAX_TEXT_BYTES}
                        warnAt={8 * 1024}
                        unit="bytes"
                        overMessage={`Transcript exceeds the 96 KB fast-input limit by ${(byteLength - MAX_TEXT_BYTES).toLocaleString()} bytes.`}
                    />
                </Card>

                <Card>
                    <SectionHeading title="Summarization Config" />
                    <SummarizerConfigForm value={config} onChange={setConfig} />
                </Card>
            </form>

            <div className="lg:sticky lg:top-20">
                <SubmitButton form="summarizer-fast-form" busy={busy} disabled={!canSubmit} label="Summarize" busyLabel="Summarizing..." className="mb-4" />
                <SummarizerResult data={summarizeMutation.data} error={error} loading={busy} />
                <JsonResult data={busy ? null : response} loading={busy} />
            </div>
        </div>
    )
}
