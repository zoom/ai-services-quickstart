import assert from 'node:assert/strict'
import { test } from 'node:test'
import { interruptionEvents, playedAudioMs, responseFailure, sessionUpdate, shouldFollowUp } from '../playground/src/products/voice-agent/lib/protocol.ts'

test('Voice session sends verified controls and disables tools without function calling', () => {
    const options = { voice: 'jenna', instructions: 'Help', phrases: ' Zoom, Atlas ', functionCalling: true, responseTokenLimit: 64 as const, toolChoice: 'required' as const }
    const configured = sessionUpdate(options).session
    assert.equal(configured.think.response_token_limit, 64)
    assert.equal(configured.think.tool_choice, 'required')
    assert.equal(configured.think.tools.length, 1)
    assert.deepEqual(configured.listen.transcription.vocabulary, { phrases: ['Zoom', 'Atlas'] })
    assert.equal('reasoning' in configured.think, false)
    const disabled = sessionUpdate({ ...options, functionCalling: false }).session
    assert.equal(disabled.think.tool_choice, 'none')
    assert.deepEqual(disabled.think.tools, [])
})

test('Barge-in truncates at heard audio, including scheduling gaps and queued audio', () => {
    const chunks = [{ startsAt: 10, duration: 1, offset: 0 }, { startsAt: 12, duration: 2, offset: 1 }]
    assert.equal(playedAudioMs(chunks, 9), 0)
    assert.equal(playedAudioMs(chunks, 10.5), 500)
    assert.equal(playedAudioMs(chunks, 11.5), 1000)
    assert.equal(playedAudioMs(chunks, 13.5), 2500)
    assert.equal(playedAudioMs(chunks, 16), 3000)
    assert.deepEqual(interruptionEvents('resp-1', { id: 'item-2', contentIndex: 0, playedMs: 500 }), [
        { type: 'response.cancel', response_id: 'resp-1' },
        { type: 'conversation.item.truncate', item_id: 'item-2', content_index: 0, audio_end_ms: 500 },
    ])
    assert.equal(interruptionEvents(null, { id: 'item-2', contentIndex: 0, playedMs: 500 }).length, 1)
    assert.deepEqual(interruptionEvents(null, null), [])
})

test('Tool continuation requires completed, uninterrupted response with tool result', () => {
    assert.equal(shouldFollowUp('completed', true, false), true)
    for (const status of ['failed', 'incomplete', 'cancelled', undefined]) assert.equal(shouldFollowUp(status, true, false), false)
    assert.equal(shouldFollowUp('completed', true, true), false)
    assert.equal(shouldFollowUp('completed', false, false), false)
    assert.match(responseFailure({ status: 'incomplete', status_details: { reason: 'max_output_tokens' } })!, /max_output_tokens/)
    assert.match(responseFailure({ status: 'failed' })!, /failed/)
    assert.equal(responseFailure({ status: 'cancelled' }), null)
})

test('Late response events retain their own identity instead of ending the active response', async () => {
    const { responseIdentity, cancellationTarget } = await import('../playground/src/products/voice-agent/lib/protocol.ts')
    const itemResponses = new Map([['item-old', 'response-old'], ['item-new', 'response-new']])
    assert.equal(responseIdentity({ response: { id: 'response-old' } }, itemResponses), 'response-old')
    assert.equal(responseIdentity({ item_id: 'item-old' }, itemResponses), 'response-old')
    assert.equal(responseIdentity({}, itemResponses), null)
    assert.equal(responseIdentity({ item_id: 'unknown' }, itemResponses), null)
    const interrupted = new Set<string>()
    assert.equal(cancellationTarget('response-old', interrupted), 'response-old')
    interrupted.add('response-old')
    assert.equal(cancellationTarget('response-old', interrupted), null)
    assert.equal(cancellationTarget(null, interrupted), null)
    assert.equal(cancellationTarget('response-new', interrupted), 'response-new')
})
