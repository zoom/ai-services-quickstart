import assert from 'node:assert/strict'
import { test } from 'node:test'
import { availableOutputLayouts, buildBatchSubmitPayload, canCancelJob, manifestValidationError } from '../playground/src/components/batch/formUtils.ts'
import { mergeFilePages } from '../playground/src/components/batch/filePages.ts'
import { defaultBatchForm } from '../playground/src/components/batch/formTypes.ts'

test('manifest count ignores comments and blanks and enforces the service range', () => {
    assert.ok(manifestValidationError('# comment\n  \n'))
    assert.equal(manifestValidationError('# comment\nhttps://example.com/a\n\n'), null)
    assert.equal(manifestValidationError(Array(1000).fill('https://example.com/a').join('\n')), null)
    assert.ok(manifestValidationError(Array(1001).fill('https://example.com/a').join('\n')))
})

test('SINGLE output is offered only for a single Scribe input', () => {
    assert.deepEqual(availableOutputLayouts('scribe', 'SINGLE'), ['PREFIX', 'SINGLE'])
    for (const product of ['scribe', 'translator', 'summarizer']) {
        assert.deepEqual(availableOutputLayouts(product, 'MANIFEST'), ['PREFIX'])
        assert.deepEqual(availableOutputLayouts(product, 'PREFIX'), ['ADJACENT', 'PREFIX'])
    }
    for (const product of ['translator', 'summarizer']) assert.deepEqual(availableOutputLayouts(product, 'SINGLE'), ['PREFIX'])
})

test('single transcript output preserves the exact destination, while adjacent omits it', () => {
    const form = { ...defaultBatchForm, config: {}, inputMode: 'SINGLE' as const, inputUri: 's3://bucket/audio.wav', outputLayout: 'SINGLE' as const, outputUri: 's3://bucket/transcript.json' }
    const output = buildBatchSubmitPayload(form).output
    assert.equal(output.layout, 'SINGLE')
    assert.equal(output.uri, 's3://bucket/transcript.json')
    assert.equal(buildBatchSubmitPayload({ ...form, inputMode: 'PREFIX', outputLayout: 'ADJACENT' }).output.uri, undefined)
})

test('cancel is restricted to queued and processing jobs', () => {
    for (const state of ['QUEUED', 'PROCESSING']) assert.equal(canCancelJob(state), true)
    for (const state of ['SUCCEEDED', 'FAILED', 'CANCELED', 'PARTIALLY_SUCCEEDED', 'UNKNOWN']) assert.equal(canCancelJob(state), false)
})


test('presigned SINGLE output does not forward explicit AWS credentials', () => {
    const form = { ...defaultBatchForm, config: {}, inputMode: 'SINGLE' as const, inputUri: 's3://bucket/audio.wav', outputLayout: 'SINGLE' as const, outputUri: 'https://example.com/output?signature=test', outputAwsFromEnv: false, outputAwsKeyId: 'test-key', outputAwsSecret: 'test-secret' }
    assert.equal(buildBatchSubmitPayload(form).output.auth, undefined)
})


test('file pagination preserves upstream-only fields in the Raw JSON list', () => {
    const previous = { files: [{ file_id: 'first' }], next_cursor: 'page-2', raw_response: { files: [{ file_id: 'first', usage: { tokens: 3 } }], next_cursor: 'page-2', extra: 'preserve' } }
    const next = { files: [{ file_id: 'second' }], raw_response: { files: [{ file_id: 'second', usage: { tokens: 5 } }], server_field: 'last page' } }
    const merged = mergeFilePages(previous, next)
    assert.deepEqual(merged.files.map(file => file.file_id), ['first', 'second'])
    assert.deepEqual(merged.raw_response.files, [{ file_id: 'first', usage: { tokens: 3 } }, { file_id: 'second', usage: { tokens: 5 } }])
    assert.equal(merged.next_cursor, undefined)
    assert.equal(merged.raw_response.next_cursor, undefined)
    assert.equal(merged.raw_response.extra, 'preserve')
    assert.equal(merged.raw_response.server_field, 'last page')
})
