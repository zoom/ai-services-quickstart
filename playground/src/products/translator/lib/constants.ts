export const TARGET_LANGUAGE_OPTIONS = [
    { value: 'en-US', label: 'English' },
    { value: 'zh-CN', label: 'Chinese (Simplified)' },
    { value: 'zh-TW', label: 'Chinese (Traditional)' },
    { value: 'ja-JP', label: 'Japanese' },
    { value: 'ko-KR', label: 'Korean' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'fr-FR', label: 'French' },
    { value: 'de-DE', label: 'German' },
    { value: 'pt-BR', label: 'Portuguese' },
    { value: 'it-IT', label: 'Italian' },
] as const

export type SourceLanguageCode = typeof TARGET_LANGUAGE_OPTIONS[number]['value']
export type TargetLanguageCode = typeof TARGET_LANGUAGE_OPTIONS[number]['value']

export type TranslatorConfig = {
    source_language: SourceLanguageCode
    target_languages: TargetLanguageCode[]
}

export const defaultTranslatorConfig: TranslatorConfig = {
    source_language: 'en-US',
    target_languages: ['es-ES'],
}

export const MAX_TEXT_LENGTH = 4000
