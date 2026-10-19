import type { RouterInputs } from '../../../lib/trpc'

export type TranslatorConfig = RouterInputs['translator']['translate']['config']
export type LanguageCode = NonNullable<TranslatorConfig['target_languages'][number]>

export { translatorLanguages as LANGUAGE_OPTIONS } from '../../../../../src/config/translatorLanguages'

export const defaultTranslatorConfig: TranslatorConfig = {
    source_language: 'en-US',
    target_languages: ['es-ES'],
}

export const MAX_TEXT_LENGTH = 4000
