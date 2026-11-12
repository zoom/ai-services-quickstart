import assert from 'node:assert/strict'
import { test } from 'node:test'
import { translatorLanguages } from '../src/config/translatorLanguages.ts'
import { decisionsInputSchema } from '../src/decisions/schema.ts'
import { apiResponseError, asTrpcError } from '../src/apiErrors.ts'
import { speechUploadPolicy, scribeUploadPolicy, validateUpload } from '../src/config/uploads.ts'
process.env.ZOOM_API_KEY = 'offline-test-key'
process.env.ZOOM_API_SECRET = 'offline-test-secret'
const { appRouter } = await import('../src/routers/index.ts')
const { speechSummarizationForm } = await import('../src/routers/speechSummarization.ts')
const caller = appRouter.createCaller({})

test('Full Summary survives validation and Raw JSON retains upstream-only nested fields', async t => {
    const upstream = { result: { full_summary: '## Decisions\nShip it.', extra: { detail: true } }, usage: { tokens: 10 }, extra_top: true }
    t.mock.method(globalThis, 'fetch', async () => Response.json(upstream))
    const response = await caller.summarizer.summarize({ input: { text: 'Ship it.' }, config: { task: 'full_summary' } })
    assert.equal(response.result?.full_summary, upstream.result.full_summary)
    assert.deepEqual(response.raw_response, upstream)
})

test('Translator accepts all 29 verified locales, any pair and source omission', async t => {
    const calls: Array<Record<string, unknown>> = []
    const upstream = { result: { translations: { 'ga-IE': 'Dia duit' } }, usage: { units: 1 } }
    t.mock.method(globalThis, 'fetch', async (_url, init) => { calls.push(JSON.parse(init?.body as string)); return Response.json(upstream) })
    assert.equal(translatorLanguages.length, 29)
    for (const locale of translatorLanguages) {
        const response = await caller.translator.translate({ text: 'Hello.', config: { target_languages: [locale.value.toLowerCase()] } })
        assert.deepEqual(response.raw_response, upstream)
        const config = calls.at(-1)?.config as Record<string, unknown>
        assert.equal('source_language' in config, false)
        assert.deepEqual(config.target_languages, [locale.value])
    }
    await caller.translator.translate({ text: 'Hola.', config: { source_language: 'es-ES', target_languages: ['de-DE'] } })
    await assert.rejects(caller.translator.translate({ text: 'Hello.', config: { target_languages: ['en'] } }), { code: 'BAD_REQUEST' })
    await assert.rejects(caller.translator.translate({ text: 'Hello.', config: { target_languages: ['en-US', 'ga-IE'] } }), { code: 'BAD_REQUEST' })
})

test('Scribe forwards candidates, optional language, word offsets and segmentation without losing raw words', async t => {
    let sent: Record<string, unknown> = {}
    const upstream = { result: { text_display: 'Hello', segments: [{ id: '1', start: 0, end: 1, text: 'Hello', words: [{ word: 'Hello', start: 0, end: 1, is_profanity_mark: false }] }] } }
    t.mock.method(globalThis, 'fetch', async (_url, init) => { sent = JSON.parse(init?.body as string); return Response.json(upstream) })
    const response = await caller.scribe.transcribe({ file: 'https://example.com/test.wav', config: {
        diarization: false, channel_separation: false, word_time_offsets: true, segmentation_mode: 'none',
        language_detection: { mode: 'continuous', candidate_languages: ['en-US', 'fr-FR'] },
    } })
    assert.deepEqual(sent.config, { diarization: false, channel_separation: false, word_time_offsets: true, segmentation_mode: 'none', language_detection: { mode: 'continuous', candidate_languages: ['en-US', 'fr-FR'] } })
    assert.deepEqual(response.raw_response, upstream)
})

test('Scribe rejects incompatible combinations before making an API call', async t => {
    const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Should not reach API') })
    const config = { diarization: false, channel_separation: false }
    for (const invalid of [
        { model: 'zoom-scribe-en', language_detection: { mode: 'once' as const } },
        { model: 'zoom-scribe-en', language_detection: { mode: 'continuous' as const } },
        { language: 'en-US', language_detection: { mode: 'continuous' as const, candidate_languages: ['fr-FR'] } },
        { language: 'zh-CN', text_polishing: true },
        { language: 'en-US', text_polishing: true, language_detection: { mode: 'once' as const } },
        { language: 'en-US', text_polishing: true, language_detection: { mode: 'continuous' as const } },
    ]) await assert.rejects(caller.scribe.transcribe({ file: 'https://example.com/test.wav', config: { ...config, ...invalid } }), { code: 'BAD_REQUEST' })
    assert.equal(mock.mock.callCount(), 0)
})

test('Decisions accepts the canonical model and reference ID', () => {
    const parsed = decisionsInputSchema.parse({ input: 'Hello', questions: [{ type: 'predicate', name: 'greeting', instructions: 'Is this a greeting?' }], model: 'zoom-decisions', reference_id: 'example-1' })
    assert.equal(parsed.model, 'zoom-decisions')
    assert.equal(parsed.reference_id, 'example-1')
})

test('Batch job cursors are sent under next_page_token and single file detail is encoded', async t => {
    const urls: string[] = []
    const file = { file_id: 'file/a', input_uri: 's3://bucket/a.wav', output_uri: null, state: 'QUEUED', usage: { seconds: 0 }, extra: true }
    t.mock.method(globalThis, 'fetch', async url => {
        urls.push(String(url))
        return Response.json(String(url).includes('/files/') ? file : { jobs: [], next_cursor: 'next/page' })
    })
    await caller.scribe.batch.list({ stateFilter: 'QUEUED', next_page_token: 'opaque+/=', page_size: 50 })
    const query = new URL(urls[0]).searchParams
    assert.equal(query.get('next_page_token'), 'opaque+/=')
    assert.equal(query.get('state'), 'QUEUED')
    assert.equal(query.get('page_size'), '50')
    const response = await caller.scribe.batch.getFile({ jobId: 'job/a', fileId: 'file/a' })
    assert.ok(urls[1].endsWith('/jobs/job%2Fa/files/file%2Fa'))
    assert.equal(response.output_uri, null)
    assert.deepEqual(response.raw_response, file)
})

test('Batch enforces manifest size and product-specific SINGLE output', async t => {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ job_id: 'job', state: 'QUEUED' }))
    await assert.rejects(caller.scribe.batch.submit({ input: { mode: 'MANIFEST', manifest: Array(1001).fill('s3://bucket/a.wav') } }), { code: 'BAD_REQUEST' })
    await assert.rejects(caller.translator.batch.submit({ input: { mode: 'SINGLE', uri: 's3://bucket/a.txt' }, output: { layout: 'SINGLE' }, config: { target_languages: ['en-US'] } }), { code: 'BAD_REQUEST' })
    assert.equal(mock.mock.callCount(), 0)
    process.env.AWS_ACCESS_KEY_ID = 'offline-aws-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'offline-aws-secret'
    try {
        await caller.scribe.batch.submit({ input: { mode: 'SINGLE', uri: 'https://example.com/a.wav' }, output: { layout: 'SINGLE', uri: 'https://example.com/result.json?signature=example' } })
        const sent = JSON.parse(mock.mock.calls[0].arguments[1]?.body as string)
        assert.equal(sent.output.auth, undefined)
    } finally { delete process.env.AWS_ACCESS_KEY_ID; delete process.env.AWS_SECRET_ACCESS_KEY }
})

test('Speech multipart always places config before file', () => {
    const form = speechSummarizationForm('{"summary":{"citations":false}}', { buffer: Buffer.from('example'), mimetype: 'audio/wav', originalname: 'example.wav' })
    assert.deepEqual([...form.keys()], ['config', 'file'])
    assert.equal((form.get('file') as File).name, 'example.wav')
})

test('Upload policies enforce the different product limits and formats', () => {
    const file = { name: 'test.wav', size: 60 * 1024 * 1024 }
    assert.match(validateUpload(file, speechUploadPolicy)!, /50 MB/)
    assert.equal(validateUpload(file, scribeUploadPolicy), null)
    assert.match(validateUpload({ name: 'test.flac', size: 100 }, speechUploadPolicy)!, /supported file/)
})

test('API errors preserve HTTP status, structured reason, request ID and retry delay', async () => {
    const response = Response.json({ error: { code: 'quota_exceeded', message: 'Try later.' }, request_id: 'req-1' }, { status: 429, headers: { 'retry-after': '30' } })
    const upstream = await apiResponseError(response)
    assert.equal(upstream.status, 429)
    assert.equal(upstream.requestId, 'req-1')
    assert.equal(upstream.retryAfter, '30')
    assert.equal(asTrpcError(upstream).code, 'TOO_MANY_REQUESTS')
    const clinical = await apiResponseError(new Response('Route Not Found', { status: 404 }), 'clinical_notes')
    assert.match(clinical.message, /route and account access/)
})
