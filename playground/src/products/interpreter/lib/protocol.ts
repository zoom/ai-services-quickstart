export const LANGUAGES = [
    ['en-US', 'English'], ['ar-AE', 'Arabic'], ['de-DE', 'German'], ['es-ES', 'Spanish'],
    ['fr-FR', 'French'], ['it-IT', 'Italian'], ['ja-JP', 'Japanese'], ['pt-PT', 'Portuguese'], ['zh-CN', 'Chinese'],
] as const
// Each target language has its own two voices; Zoom rejects any other pairing.
const VOICES: Record<string, string[]> = {
    'en-US': ['sarah', 'cole'], 'ar-AE': ['layla', 'omar'], 'de-DE': ['helena', 'felix'], 'es-ES': ['sofia', 'carlos'],
    'fr-FR': ['camille', 'marc'], 'it-IT': ['elena', 'luca'], 'ja-JP': ['hana', 'kenji'], 'pt-PT': ['beatriz', 'tiago'], 'zh-CN': ['lin', 'bo'],
}
export const voicesForLanguage = (language: string) => VOICES[language] ?? []
export type InterpreterOptions = { source: string; target: string; voice: string; transcription: boolean }

export function sessionUpdate(options: InterpreterOptions) {
    if (options.source === options.target) throw new Error('Choose different source and target languages.')
    if (!voicesForLanguage(options.target).includes(options.voice)) throw new Error('Choose a supported voice for the target language.')
    return {
        type: 'session.update',
        session: { audio: {
            input: { language: options.source, ...(options.transcription && { transcription: {} }) },
            output: { language: options.target, voice: options.voice },
        } },
    }
}

// 500 ms of 16 kHz mono PCM16, the Interpreter per-message maximum. Send 100–200 ms per message.
const MAX_AUDIO_BYTES = 16000

export function audioAppend(buffer: ArrayBuffer) {
    if (!buffer.byteLength || buffer.byteLength % 2 || buffer.byteLength > MAX_AUDIO_BYTES) throw new Error('Send complete PCM16 samples of at most 500 ms (16,000 bytes).')
    return { type: 'session.input_audio_buffer.append' as const, audio: toBase64(buffer) }
}

export type InterpreterEvent = {
    type: string
    session?: { id?: string; expires_at?: number; [key: string]: unknown }
    delta?: string
    reason?: string
    error?: { message?: string; code?: string; param?: string; fatal?: boolean }
}
import { toBase64 } from '../../../lib/pcm.ts'

