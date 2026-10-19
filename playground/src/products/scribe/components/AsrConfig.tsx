import { useState } from 'react'
import { CONTINUOUS_MODELS, normalizeAsrConfig, polishingAllowed } from '../lib/config'
import { MAX_VOCABULARY_PHRASES, MODEL_OPTIONS, type AsrConfig } from '../lib/constants'
import { inputCls, selectCls } from '../../../lib/constants'
import { Field, ToggleRow } from '../../../components/ui'

// `live` hides options Live mode doesn't support (channel separation, once-only detection).
export function AsrConfigForm({ value, onChange, live = false }: { value: AsrConfig; onChange: (v: AsrConfig) => void; live?: boolean }) {
    const set = (patch: Partial<AsrConfig>) => onChange(normalizeAsrConfig({ ...value, ...patch }, live))
    const phrases = value.vocabulary?.phrases.join('\n') ?? ''

    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Model" hint="Automatic picks a compatible model">
                    <select className={selectCls} value={value.model ?? ''} onChange={e => set({ model: e.target.value || undefined })}>
                        {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value} disabled={!!o.value && (value.language_detection?.mode === 'once' || (!!value.language_detection && !CONTINUOUS_MODELS.includes(o.value)) || (o.value.startsWith('zoom-scribe-en') && value.language !== 'en-US'))}>{o.label}</option>)}
                    </select>
                </Field>
                <Field label={value.language_detection ? "Preferred initial language" : "Language"} hint={value.language_detection ? "Leave empty for no preference; a preferred language is included in candidates" : "BCP-47 code — en-US, es-ES, fr-FR, ja-JP…"}>
                    <input className={inputCls} value={value.language ?? ''} onChange={e => set({ language: e.target.value || undefined })} placeholder="en-US" />
                </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Language detection" hint={live ? 'Live supports continuous detection' : 'Once selects a model automatically; Continuous follows language changes'}>
                    <select className={selectCls} value={value.language_detection?.mode ?? 'off'} onChange={e => set({ language_detection: e.target.value === 'off' ? undefined : { ...value.language_detection, mode: e.target.value as 'once' | 'continuous' } })}>
                        <option value="off">Off</option>
                        {!live && <option value="once">Once</option>}
                        <option value="continuous">Continuous</option>
                    </select>
                </Field>
                {value.language_detection && <CandidateLanguages preferred={value.language} value={value.language_detection.candidate_languages ?? []} onChange={candidates => set({ language_detection: { ...value.language_detection!, candidate_languages: candidates.length ? candidates : undefined } })} />}
                <ToggleRow label="Speaker diarization" hint="Label each segment with its speaker" checked={value.diarization} onChange={v => set({ diarization: v })} />
                {!live && (
                    <ToggleRow label="Channel separation" hint="Transcribe stereo channels independently" checked={value.channel_separation} onChange={v => set({ channel_separation: v })} />
                )}
                <ToggleRow label="Profanity filter" hint="Mask profanity in the transcript" checked={!!value.profanity_filter} onChange={v => set({ profanity_filter: v || undefined })} />
                <fieldset disabled={!polishingAllowed(value)} className="disabled:opacity-50">
                    <ToggleRow label="Text Polishing" hint="Requires en-US with language detection off" checked={!!value.text_polishing} onChange={v => set({ text_polishing: v || undefined })} />
                </fieldset>
                {!live && <>
                    <ToggleRow label="Word timestamps" hint="Include word-level offsets in the response" checked={!!value.word_time_offsets} onChange={v => set({ word_time_offsets: v })} />
                    <Field label="Segmentation" hint="Split at pauses, or return unsegmented output">
                        <select className={selectCls} value={value.segmentation_mode ?? 'auto'} onChange={e => set({ segmentation_mode: e.target.value as 'auto' | 'none' })}>
                            <option value="auto">Automatic</option>
                            <option value="none">None</option>
                        </select>
                    </Field>
                </>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                <Field label="Custom vocabulary" hint={`One phrase per line, up to ${MAX_VOCABULARY_PHRASES}`}>
                    <textarea
                        className={inputCls + ' resize-none'}
                        rows={3}
                        value={phrases}
                        disabled={!!value.vocabulary_id}
                        onChange={e => {
                            const list = e.target.value.split('\n')
                            set({ vocabulary: list.some(p => p.trim()) ? { phrases: list.slice(0, MAX_VOCABULARY_PHRASES) } : undefined })
                        }}
                        placeholder={'Project Atlas\nJane Chen'}
                    />
                </Field>
                <Field label="Vocabulary Asset ID" hint="Instead of inline phrases">
                    <input
                        className={inputCls}
                        value={value.vocabulary_id ?? ''}
                        disabled={!!value.vocabulary}
                        onChange={e => set({ vocabulary_id: e.target.value.trim() || undefined })}
                        placeholder="acct_vocab_…"
                    />
                </Field>
            </div>
        </div>
    )
}

function parseCandidates(text: string) { return [...new Set(text.split(/[\n,]/).map(s => s.trim()).filter(Boolean))] }

function CandidateLanguages({ value, preferred, onChange }: { value: string[]; preferred?: string; onChange: (value: string[]) => void }) {
    const canonical = JSON.stringify(value)
    const [edit, setEdit] = useState({ canonical, draft: value.join('\n') })
    const draft = edit.canonical === canonical ? edit.draft : value.join('\n')
    return <Field label="Candidate languages" hint="Optional BCP-47 codes, one per line or comma-separated; preferred language is included automatically">
        <textarea className={inputCls} rows={2} value={draft} placeholder={'en-US\nfr-FR'} onChange={e => {
            const candidates = parseCandidates(e.target.value)
            const effective = candidates.length && preferred && !candidates.includes(preferred) ? [preferred, ...candidates] : candidates
            setEdit({ canonical: JSON.stringify(effective), draft: e.target.value })
            onChange(candidates)
        }} />
    </Field>
}
