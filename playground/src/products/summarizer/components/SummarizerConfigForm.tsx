import { Field } from '../../../components/ui'
import { selectCls } from '../../../lib/constants'
import {
    LANGUAGE_OPTIONS,
    TASK_OPTIONS,
    type FastSummarizerConfig,
    type SummarizerLanguage,
    type SummarizerTask,
} from '../lib/constants'

export function SummarizerConfigForm({
    value,
    onChange,
}: {
    value: FastSummarizerConfig
    onChange: (value: FastSummarizerConfig) => void
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Task" hint="Choose the summarization type">
                <select
                    className={selectCls}
                    value={value.task}
                    onChange={e => onChange({ ...value, task: e.target.value as SummarizerTask })}
                >
                    {TASK_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label} - {option.hint}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="Output Language" hint="Choose the language of the output">
                <select
                    className={selectCls}
                    value={value.language}
                    onChange={e => onChange({ ...value, language: e.target.value as SummarizerLanguage })}
                >
                    {LANGUAGE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </Field>
        </div>
    )
}
