import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeAsrConfig, polishedText, toSessionUpdate } from '../playground/src/products/scribe/lib/config.ts'

const base = { language: 'en-US', channel_separation: false, diarization: false }

test('Detection removes incompatible explicit models and retains candidate preference', () => {
    const once = normalizeAsrConfig({ ...base, model: 'zoom-scribe-en', language_detection: { mode: 'once', candidate_languages: ['fr-FR'] } })
    assert.equal(once.model, undefined)
    assert.deepEqual(once.language_detection?.candidate_languages, ['en-US', 'fr-FR'])
    const continuous = normalizeAsrConfig({ ...base, model: 'zoom-scribe-en-pro', language_detection: { mode: 'continuous' } })
    assert.equal(continuous.model, undefined)
    assert.equal(normalizeAsrConfig({ ...continuous, model: 'whisper' }).model, 'whisper')
    assert.equal(normalizeAsrConfig({ ...once, language: undefined }).language, undefined)
    assert.equal(normalizeAsrConfig({ ...base, language: 'fr-FR', model: 'zoom-scribe-en' }).model, undefined)
})

test('Polishing is removed when the form changes to a non-English or detected language', () => {
    assert.equal(normalizeAsrConfig({ ...base, text_polishing: true }).text_polishing, true)
    assert.equal(normalizeAsrConfig({ ...base, language: 'zh-CN', text_polishing: true }).text_polishing, undefined)
    assert.equal(normalizeAsrConfig({ ...base, text_polishing: true, language_detection: { mode: 'continuous' } }).text_polishing, undefined)
    assert.deepEqual(polishedText('[polishing_failed:timeout]'), { warning: '[polishing_failed:timeout]', text: undefined })
    assert.deepEqual(polishedText('Clean transcript.'), { warning: undefined, text: 'Clean transcript.' })
})

test('Live config omits Fast-only settings, normalizes detection and trims vocabulary', () => {
    const update = toSessionUpdate({ ...base, channel_separation: true, word_time_offsets: true, segmentation_mode: 'none', model: 'zoom-scribe-en', language_detection: { mode: 'once', candidate_languages: ['en-US', 'fr-FR'] }, vocabulary: { phrases: [' Atlas ', ' '] } }, true)
    assert.equal(update.config.language_detection?.mode, 'continuous')
    assert.equal(update.config.model, undefined)
    assert.equal('channel_separation' in update.config, false)
    assert.equal('word_time_offsets' in update.config, false)
    assert.equal('segmentation_mode' in update.config, false)
    assert.deepEqual(update.config.vocabulary, { phrases: ['Atlas'] })
    assert.equal(update.config.interim_results, true)
    assert.deepEqual(update.audio, { format: 'pcm16' })
})

test('Fast config preserves word timestamps and segmentation controls', () => {
    const config = normalizeAsrConfig({ ...base, word_time_offsets: true, segmentation_mode: 'none' })
    assert.equal(config.word_time_offsets, true)
    assert.equal(config.segmentation_mode, 'none')
})

test('Live readiness cannot resume after Stop or a closed session', async () => {
    const { LiveSessionGate } = await import('../playground/src/products/scribe/lib/config.ts')
    const gate = new LiveSessionGate()
    gate.begin()
    assert.equal(gate.canStream, false)
    assert.equal(gate.accept(), true)
    assert.equal(gate.canStream, true)
    assert.equal(gate.configure(), true)
    assert.equal(gate.canStream, false)
    assert.equal(gate.reject(), true)
    assert.equal(gate.configure(), true)
    gate.stop()
    assert.equal(gate.accept(), false)
    assert.equal(gate.reject(), false)
    assert.equal(gate.configure(), false)
    assert.equal(gate.canStream, false)
    gate.close()
    assert.equal(gate.accept(), false)
    gate.begin()
    assert.equal(gate.accept(), true)
    assert.equal(gate.canStream, true)
})
