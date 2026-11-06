import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialSpeechState, parseSse, reduceSpeechEvent, finishSpeechStream, withCitations } from '../playground/src/products/speech-summarization/lib/stream.ts'
const event = (event: string, data: unknown) => ({ event, data: JSON.stringify(data) })

test('SSE parses chunk boundaries, CRLF, comments and multiline data', () => {
    const [first, rest] = parseSse(': keepalive\r\n\r\nevent: summary_updated\r\ndata: {"summary_result":')
    assert.deepEqual(first, [])
    const [second, remainder] = parseSse(rest + '"Hello",\r\ndata: "response_state":"working"}\r\n\r\n')
    assert.equal(second.length, 1)
    assert.equal(JSON.parse(second[0].data).summary_result, 'Hello')
    assert.equal(remainder, '')
})

test('Successful summary replaces cumulative text and needs both completed and done', () => {
    let state = reduceSpeechEvent(initialSpeechState(), event('transcribe_complete', { transcript: { result: { text_display: 'Transcript' } } }))
    state = reduceSpeechEvent(state, event('summary_updated', { summary_result: 'First', response_state: 'working', citations: null, error: null }))
    state = reduceSpeechEvent(state, event('summary_updated', { summary_result: 'Final', response_state: 'completed', citations: [], error: null }))
    assert.equal(state.summary, 'Final')
    assert.equal(finishSpeechStream(state).status, 'failed')
    state = reduceSpeechEvent(state, event('done', { latency: 123 }))
    assert.equal(finishSpeechStream(state).status, 'completed')
    assert.equal(state.transcript, 'Transcript')
})

test('Summary failures retain the completed transcript and partial summary', () => {
    let state = reduceSpeechEvent(initialSpeechState(), event('transcribe_complete', { transcript: { result: { text_display: 'Keep me' } } }))
    state = reduceSpeechEvent(state, event('summary_updated', { summary_result: 'Partial', response_state: 'working' }))
    state = reduceSpeechEvent(state, event('summary_updated', { response_state: 'error', error: { message: 'Timeout' } }))
    state = reduceSpeechEvent(state, event('done', {}))
    assert.equal(state.status, 'failed')
    assert.equal(state.transcript, 'Keep me')
    assert.equal(state.summary, 'Partial')
    assert.match(state.error!, /Timeout/)
})

test('Premature EOF, malformed events and done without completed summary never look successful', () => {
    assert.equal(finishSpeechStream(initialSpeechState()).status, 'failed')
    assert.equal(finishSpeechStream(initialSpeechState(), 'event: done').status, 'failed')
    assert.equal(reduceSpeechEvent(initialSpeechState(), event('done', {})).status, 'failed')
    assert.equal(reduceSpeechEvent(initialSpeechState(), { event: 'summary_updated', data: '{' }).status, 'failed')
    assert.equal(reduceSpeechEvent(initialSpeechState(), event('error', { error: 'failed' })).status, 'failed')
})

test('Timestamp-only citations render without an invented speaker or undefined text', () => {
    const markdown = withCitations('A decision.[^1] Extra[^2]', [{ id: 1, start_time: '00:00:01', end_time: '00:00:03' }])
    assert.match(markdown, /\[\^1\]: \(00:00:01–00:00:03\)/)
    assert.ok(!markdown.includes('undefined'))
    assert.ok(!markdown.includes('[^2]'))
})
