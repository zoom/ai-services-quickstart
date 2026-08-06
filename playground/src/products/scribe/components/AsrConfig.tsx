import type { AsrConfig } from '../lib/constants'
import { inputCls } from '../../../lib/constants'
import { Field } from '../../../components/ui'

type TranscriptStructure = 'standard' | 'channel' | 'speaker'

const structureOptions: Array<{
    value: TranscriptStructure
    label: string
    hint: string
}> = [
    { value: 'standard', label: 'Default', hint: 'One continuous transcript' },
    { value: 'channel', label: 'Channel separation', hint: 'Transcribe stereo channels independently' },
    { value: 'speaker', label: 'Speaker diarization', hint: 'Identify speakers in a mixed audio channel' },
]

export function AsrConfigForm({ value, onChange }: { value: AsrConfig; onChange: (v: AsrConfig) => void }) {
    const structure: TranscriptStructure = value.channel_separation
        ? 'channel'
        : value.diarization
            ? 'speaker'
            : 'standard'

    const setStructure = (next: TranscriptStructure) => onChange({
        ...value,
        channel_separation: next === 'channel',
        diarization: next === 'speaker',
    })

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,0.8fr)_minmax(0,1.7fr)] gap-5 lg:items-end">
            <Field label="Language" hint="BCP-47 code — en-US, es-ES, fr-FR, ja-JP…">
                <input
                    className={inputCls}
                    value={value.language}
                    onChange={e => onChange({ ...value, language: e.target.value })}
                    placeholder="en-US"
                />
            </Field>

            <fieldset>
                <legend className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Audio processing</legend>
                <p className="text-xs text-gray-500 leading-relaxed mt-1.5 mb-1.5">Choose one processing option</p>
                <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {structureOptions.map(option => {
                        const selected = structure === option.value
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => setStructure(option.value)}
                                className={[
                                    'relative min-w-0 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-zoom-blue/25',
                                    selected
                                        ? 'border-zoom-blue bg-zoom-blue/5 shadow-sm'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                                ].join(' ')}
                            >
                                <span className="flex items-center gap-2">
                                    <span className={[
                                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                                        selected ? 'border-zoom-blue' : 'border-gray-300',
                                    ].join(' ')}>
                                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-zoom-blue" />}
                                    </span>
                                    <span className={selected ? 'text-sm font-semibold text-gray-800' : 'text-sm font-medium text-gray-700'}>
                                        {option.label}
                                    </span>
                                </span>
                                <span className="mt-1 block pl-5.5 text-xs leading-snug text-gray-500">{option.hint}</span>
                            </button>
                        )
                    })}
                </div>
            </fieldset>
        </div>
    )
}
