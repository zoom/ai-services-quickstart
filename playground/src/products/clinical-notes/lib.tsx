import { MarkdownContent } from '../../components/MarkdownContent'
import { Field } from '../../components/ui'
import { selectCls } from '../../lib/constants'
import type { RouterInputs, RouterOutputs } from '../../lib/trpc'

export type Template = RouterInputs['clinicalNotes']['generate']['template']

const TEMPLATES: Array<{ value: Template; label: string }> = [
    { value: 'GENERAL_MEDICINE', label: 'General Medicine (default)' },
    { value: 'SOAP', label: 'SOAP' },
    { value: 'GENERAL_BEHAVIORAL_HEALTH', label: 'General Behavioral Health' },
]

export function TemplateSelect({ value, onChange }: { value: Template; onChange: (v: Template) => void }) {
    return (
        <Field label="Template" hint="Structure of the generated note">
            <select className={selectCls} value={value} onChange={e => onChange(e.target.value as Template)}>
                {TEMPLATES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
        </Field>
    )
}

// Renders the note sections and the transcript from a generate or SUCCEEDED job response.
export function NoteResult({ data }: { data?: Pick<RouterOutputs['clinicalNotes']['generate'], 'transcript' | 'clinical_notes'> }) {
    const sections = data?.clinical_notes?.sections ?? []
    if (!sections.length && !data?.transcript?.text_display) return null
    return (
        <div className="flex flex-col gap-3">
            {sections.map(s => (
                <div key={s.title} className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                    <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{s.title}</h3>
                    <MarkdownContent>{s.content}</MarkdownContent>
                </div>
            ))}
            {data?.transcript?.text_display && (
                <div className="rounded-lg border border-gray-200 p-4">
                    <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Transcript</h3>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{data.transcript.text_display}</p>
                </div>
            )}
        </div>
    )
}
