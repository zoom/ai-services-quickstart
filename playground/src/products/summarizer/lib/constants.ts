export const MAX_TEXT_BYTES = 96 * 1024

export const TASK_OPTIONS = [
    { value: 'recap', label: 'Recap', hint: '1-2 sentence overview' },
    { value: 'action_items', label: 'Action Items', hint: 'Extract next steps only' },
    { value: 'summary', label: 'Summary', hint: 'Detailed conversation summary' },
    { value: 'full_summary', label: 'Full Summary', hint: 'Recap, summary, and action items' },
] as const

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
] as const

export type SummarizerTask = typeof TASK_OPTIONS[number]['value']
export type SummarizerLanguage = typeof LANGUAGE_OPTIONS[number]['value']

export type FastSummarizerConfig = {
    task: SummarizerTask
    language: SummarizerLanguage
    summary_type: 'conversation'
}

export type BatchSummarizerConfig = FastSummarizerConfig

export const defaultFastSummarizerConfig: FastSummarizerConfig = {
    task: 'summary',
    language: 'en-us',
    summary_type: 'conversation',
}

export const defaultBatchSummarizerConfig = defaultFastSummarizerConfig

export const DEFAULT_TRANSCRIPT_GLOB = ''
