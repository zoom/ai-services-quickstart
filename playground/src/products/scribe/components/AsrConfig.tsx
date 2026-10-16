import { MAX_VOCABULARY_PHRASES, MODEL_OPTIONS, type AsrConfig } from '../lib/constants'
import { inputCls, selectCls } from '../../../lib/constants'
import { Field, ToggleRow } from '../../../components/ui'

// `live` hides options Live mode doesn't support (channel separation, once-only detection).
export function AsrConfigForm({ value, onChange, live = false }: { value: AsrConfig; onChange: (v: AsrConfig) => void; live?: boolean }) {
    const set = (patch: Partial<AsrConfig>) => onChange({ ...value, ...patch })
    const phrases = value.vocabulary?.phrases.join('\n') ?? ''

    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Model" hint="Automatic picks a compatible model">
                    <select className={selectCls} value={value.model ?? ''} onChange={e => set({ model: e.target.value || undefined })}>
                        {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Field>
                <Field label="Language" hint="BCP-47 code — en-US, es-ES, fr-FR, ja-JP…">
                    <input className={inputCls} value={value.language} onChange={e => set({ language: e.target.value })} placeholder="en-US" />
                </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleRow
                    label="Detect language automatically"
                    hint={live ? 'Detects language changes continuously' : 'Detects language changes as the audio is processed'}
                    checked={!!value.language_detection}
                    onChange={v => set({ language_detection: v ? { mode: 'continuous' } : undefined })}
                />
                <ToggleRow label="Speaker diarization" hint="Label each segment with its speaker" checked={value.diarization} onChange={v => set({ diarization: v })} />
                {!live && (
                    <ToggleRow label="Channel separation" hint="Transcribe stereo channels independently" checked={value.channel_separation} onChange={v => set({ channel_separation: v })} />
                )}
                <ToggleRow label="Profanity filter" hint="Mask profanity in the transcript" checked={!!value.profanity_filter} onChange={v => set({ profanity_filter: v || undefined })} />
                <ToggleRow label="Text Polishing" hint="Return clean written text (en-US only)" checked={!!value.text_polishing} onChange={v => set({ text_polishing: v || undefined })} />
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
