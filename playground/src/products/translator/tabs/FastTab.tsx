import { useState } from 'react'
import { JsonResult } from '../../../components/JsonResult'
import { Card, LimitedTextarea, SectionHeading, SubmitButton } from '../../../components/ui'
import { defaultTranslatorConfig, MAX_TEXT_LENGTH, type TranslatorConfig } from '../lib/constants'
import { TranslatorConfigForm } from '../components/TranslatorConfigForm'
import { TranslatorResult } from '../components/TranslatorResult'
import { trpc } from '../../../lib/trpc'

export function FastTab() {
    const [text, setText] = useState('')
    const [config, setConfig] = useState<TranslatorConfig>(defaultTranslatorConfig)

    const translateMutation = trpc.translator.translate.useMutation()

    const canSubmit = text.trim().length > 0 && text.length <= MAX_TEXT_LENGTH

    const handleSubmit = (e: React.SubmitEvent) => {
        e.preventDefault()
        translateMutation.mutate({ text, config })
    }

    const busy = translateMutation.isPending
    const error = translateMutation.error?.message
    const response = translateMutation.data ?? (error ? { error } : null)

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="translator-fast-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Text to Translate" />
                    <LimitedTextarea
                        rows={8}
                        value={text}
                        onChange={setText}
                        placeholder="Enter text to translate - chat messages, UI strings, short notes, or workflow actions..."
                        used={text.length}
                        max={MAX_TEXT_LENGTH}
                        warnAt={200}
                        overMessage={`Text exceeds the ${MAX_TEXT_LENGTH.toLocaleString()} character limit by ${(text.length - MAX_TEXT_LENGTH).toLocaleString()} characters.`}
                    />
                </Card>

                <Card>
                    <SectionHeading title="Translator Config" />
                    <TranslatorConfigForm value={config} onChange={setConfig} />
                </Card>
            </form>

            <div className="lg:sticky lg:top-20">
                <SubmitButton form="translator-fast-form" busy={busy} disabled={!canSubmit} label="Translate" busyLabel="Translating..." className="mb-4" />
                <TranslatorResult data={translateMutation.data} error={error} loading={busy} />
                <JsonResult data={busy ? null : response} loading={busy} />
            </div>
        </div>
    )
}
