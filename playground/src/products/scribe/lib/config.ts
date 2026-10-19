import type { AsrConfig } from './constants'

export const CONTINUOUS_MODELS = ['zoom-scribe-multilingual', 'whisper']

export function polishingAllowed(config: AsrConfig) {
    return config.language === 'en-US' && !config.language_detection
}

export function normalizeAsrConfig(config: AsrConfig, live = false): AsrConfig {
    const next = { ...config }
    if (next.language_detection) {
        const mode = live ? 'continuous' : next.language_detection.mode
        const candidates = [...new Set(next.language_detection.candidate_languages?.map(s => s.trim()).filter(Boolean))]
        if (candidates.length && next.language && !candidates.includes(next.language)) candidates.unshift(next.language)
        next.language_detection = { mode, ...(candidates.length && { candidate_languages: candidates }) }
        if (mode === 'once' || (next.model && !CONTINUOUS_MODELS.includes(next.model))) next.model = undefined
    } else if (!next.language) next.language = 'en-US'
    if (next.model?.startsWith('zoom-scribe-en') && next.language !== 'en-US') next.model = undefined
    if (!polishingAllowed(next)) next.text_polishing = undefined
    if (live) {
        next.channel_separation = false
        next.word_time_offsets = undefined
        next.segmentation_mode = undefined
    }
    return next
}

export function polishedText(text: string | undefined) {
    return text?.startsWith('[polishing_failed:') ? { warning: text, text: undefined } : { warning: undefined, text }
}

export function toSessionUpdate(value: AsrConfig, captions: boolean) {
    const { text_polishing, vocabulary, ...config }: Partial<AsrConfig> = normalizeAsrConfig(value, true)
    delete config.channel_separation
    delete config.word_time_offsets
    delete config.segmentation_mode
    const phrases = vocabulary?.phrases.map(p => p.trim()).filter(Boolean)
    return {
        type: 'session.update',
        config: { ...config, interim_results: captions, ...(phrases?.length && { vocabulary: { phrases } }) },
        audio: { format: 'pcm16' },
        ...(text_polishing && { outputs: { text_polishing: { enabled: true, include_transcript: true } } }),
    }
}

// Keep transport lifetime separate from microphone readiness. A late config
// acknowledgement must never undo Stop while final transcription is flushing.
export class LiveSessionGate {
    private phase: 'pending' | 'ready' | 'recoverable' | 'stopping' | 'closed' = 'closed'
    begin() { this.phase = 'pending' }
    get canStream() { return this.phase === 'ready' }
    get canConfigure() { return this.phase !== 'stopping' && this.phase !== 'closed' }
    configure() { if (!this.canConfigure) return false; this.phase = 'pending'; return true }
    accept() { if (!this.canConfigure) return false; this.phase = 'ready'; return true }
    reject() { if (!this.canConfigure) return false; this.phase = 'recoverable'; return true }
    stop() { this.phase = 'stopping' }
    close() { this.phase = 'closed' }
}
