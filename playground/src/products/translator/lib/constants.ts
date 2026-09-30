import type { RouterInputs } from '../../../lib/trpc'

export type TranslatorConfig = RouterInputs['translator']['translate']['config']
export type LanguageCode = TranslatorConfig['source_language']

// `satisfies` fails the build if an option drifts from the server's enum.
export const LANGUAGE_OPTIONS = [
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
] as const satisfies readonly { value: LanguageCode; label: string }[]

export const defaultTranslatorConfig: TranslatorConfig = {
    source_language: 'en-US',
    target_languages: ['es-ES'],
}

export const MAX_TEXT_LENGTH = 4000
