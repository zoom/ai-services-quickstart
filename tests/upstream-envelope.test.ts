import assert from 'node:assert/strict'
import { test } from 'node:test'
import { UpstreamApiError } from '../src/apiErrors.ts'

process.env.ZOOM_API_KEY = 'offline-test-key'
process.env.ZOOM_API_SECRET = 'offline-test-secret'
const { appRouter } = await import('../src/routers/index.ts')
const caller = appRouter.createCaller({})

for (const code of [750019, '750019']) {
    test(`HTTP 200 gateway error (${typeof code} code) retains its reason, body and trace`, async t => {
        t.mock.method(console, 'log', () => {})
        const body = { code, message: 'Open API Gateway Template Rewrite Error' }
        t.mock.method(globalThis, 'fetch', async () => Response.json(body, { headers: { 'x-zm-request-id': 'gateway-request', 'retry-after': '10' } }))
        await assert.rejects(caller.scribe.batch.getFile({ jobId: 'job', fileId: 'file' }), error => {
            const upstream = (error as { code: string; cause: unknown })
            assert.equal(upstream.code, 'BAD_GATEWAY')
            assert.match((error as Error).message, /750019.*Open API Gateway Template Rewrite Error/)
            assert.doesNotMatch((error as Error).message, /expected string/)
            assert.ok(upstream.cause instanceof UpstreamApiError)
            assert.equal(upstream.cause.status, 200)
            assert.equal(upstream.cause.requestId, 'gateway-request')
            assert.equal(upstream.cause.retryAfter, '10')
            assert.deepEqual(upstream.cause.body, body)
            return true
        })
    })
}

test('HTTP 200 error envelopes cannot silently pass endpoints with optional result fields', async t => {
    t.mock.method(console, 'log', () => {})
    t.mock.method(globalThis, 'fetch', async () => Response.json({ code: 750019, message: 'Gateway error' }))
    await assert.rejects(caller.scribe.transcribe({ file: 'https://example.com/audio.wav', config: { channel_separation: false, diarization: false } }), { code: 'BAD_GATEWAY' })
})

for (const state of ['FAILED', 'PARTIAL']) {
    test(`${state} job responses with nested errors remain valid job data`, async t => {
        t.mock.method(console, 'log', () => {})
        const body = { job_id: 'job', state, error: { code: 'INVALID_INPUT', message: 'Missing file' }, summary: { total_files: 2, succeeded: state === 'PARTIAL' ? 1 : 0, failed: 1 } }
        t.mock.method(globalThis, 'fetch', async () => Response.json(body))
        const response = await caller.scribe.batch.getStatus({ jobId: 'job' })
        assert.equal(response.state, state)
        assert.equal(response.error?.message, 'Missing file')
        assert.deepEqual(response.raw_response, body)
    })
}

test('zero-code success envelopes preserve the complete file response', async t => {
    t.mock.method(console, 'log', () => {})
    const body = { code: 0, message: 'OK', file_id: 'file', input_uri: 's3://bucket/a.wav', state: 'FILE_SUCCEEDED', usage: { input_units: 3 } }
    t.mock.method(globalThis, 'fetch', async () => Response.json(body))
    const response = await caller.scribe.batch.getFile({ jobId: 'job', fileId: 'file' })
    assert.equal(response.file_id, 'file')
    assert.deepEqual(response.raw_response, body)
})
