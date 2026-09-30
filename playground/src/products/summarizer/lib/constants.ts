import type { RouterInputs } from '../../../lib/trpc'

// Required: the server fills defaults, but the form always sends every field.
export type SummarizerConfig = Required<RouterInputs['summarizer']['summarize']['config']>

export const MAX_TEXT_BYTES = 96 * 1024

// `satisfies` fails the build if an option drifts from the server's enum.
export const TASK_OPTIONS = [
    { value: 'recap', label: 'Recap', hint: '1-2 sentence overview' },
    { value: 'action_items', label: 'Action Items', hint: 'Extract next steps only' },
    { value: 'summary', label: 'Summary', hint: 'Detailed conversation summary' },
    { value: 'full_summary', label: 'Full Summary', hint: 'Recap, summary, and action items' },
] as const satisfies readonly { value: SummarizerConfig['task']; label: string; hint: string }[]

export const LANGUAGE_OPTIONS = [
    { value: 'en-us', label: 'English (US)' },
    { value: 'zh-cn', label: 'Chinese (Simplified)' },
    { value: 'ja-jp', label: 'Japanese' },
    { value: 'es-es', label: 'Spanish' },
    { value: 'fr-fr', label: 'French' },
    { value: 'de-de', label: 'German' },
    { value: 'pt-br', label: 'Portuguese' },
    { value: 'it-it', label: 'Italian' },
    { value: 'ar-sa', label: 'Arabic (Saudi Arabia)' },
    { value: 'ar-ae', label: 'Arabic (UAE)' },
] as const satisfies readonly { value: SummarizerConfig['language']; label: string }[]

export const defaultSummarizerConfig: SummarizerConfig = {
    task: 'summary',
    language: 'en-us',
    summary_type: 'conversation',
}
