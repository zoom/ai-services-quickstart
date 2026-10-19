import type { RouterInputs } from '../../../lib/trpc'

export type AsrConfig = RouterInputs['scribe']['transcribe']['config']

export const defaultAsrConfig: AsrConfig = {
    language: 'en-US',
    channel_separation: false,
    diarization: false,
}

// An empty value omits `model`, so Scribe picks a compatible model automatically.
export const MODEL_OPTIONS = [
    { value: '', label: 'Automatic' },
    { value: 'zoom-scribe-en', label: 'Zoom Scribe English' },
    { value: 'zoom-scribe-en-pro', label: 'Scribe API 3B Pro High-Accuracy (English)' },
    { value: 'zoom-scribe-multilingual', label: 'Zoom multilingual (10 languages)' },
    { value: 'whisper', label: 'Whisper (broader language coverage)' },
]

export const MAX_VOCABULARY_PHRASES = 100
