import assert from 'node:assert/strict'
import { test } from 'node:test'
import { manifestValidationError, buildBatchSubmitPayload } from '../playground/src/components/batch/formUtils.ts'
import { defaultBatchForm } from '../playground/src/components/batch/formTypes.ts'

process.env.ZOOM_API_KEY = 'offline-test-key'
process.env.ZOOM_API_SECRET = 'offline-test-secret'
const { appRouter } = await import('../src/routers/index.ts')
const caller = appRouter.createCaller({})

for (const manifest of [
    '# Mixed sources\ns3://bucket/a.wav\n\nhttps://example.com/b.wav',
    'https://example.com/b.wav\ns3://bucket/a.wav',
]) {
    test(`mixed manifests are blocked regardless of source order: ${manifest.startsWith('https') ? 'HTTPS first' : 'S3 first'}`, () => {
        assert.match(manifestValidationError(manifest)!, /Submit separate jobs/)
    })
}

for (const manifest of ['not-a-uri', 'ftp://example.com/a.wav', 'http://example.com/a.wav', 'https:example.com/a.wav']) {
    test(`unsupported manifest entry is explained before submission: ${manifest}`, () => {
        assert.match(manifestValidationError(manifest)!, /valid s3:\/\/ URIs or https:\/\/ URLs/)
    })
}

test('homogeneous manifests keep the correct request source after comments and blanks are removed', () => {
    for (const [manifest, source] of [
        ['# Private files\ns3://bucket/a.wav\n\ns3://bucket/b.wav', 'S3'],
        ['# Public files\nhttps://example.com/a.wav\n\nHTTPS://example.com/b.wav', undefined],
    ] as const) {
        assert.equal(manifestValidationError(manifest), null)
        const payload = buildBatchSubmitPayload({ ...defaultBatchForm, config: {}, inputMode: 'MANIFEST', manifest })
        assert.equal(payload.input.source, source)
        assert.equal(payload.input.manifest?.length, 2)
    }
})

const configs = {
    scribe: { language: 'en-US', channel_separation: false, diarization: false },
    translator: { target_languages: ['es-ES'] },
    summarizer: { task: 'summary' as const },
}
for (const product of ['scribe', 'translator', 'summarizer'] as const) {
    test(`${product}: server rejects mixed manifests without making an upstream request`, async t => {
        const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not reach upstream') })
        await assert.rejects(caller[product].batch.submit({
            input: { mode: 'MANIFEST', source: 'S3', manifest: ['s3://bucket/a.wav', 'https://example.com/b.wav'] },
            config: configs[product],
        } as never), error => {
            assert.equal((error as { code: string }).code, 'BAD_REQUEST')
            assert.match((error as Error).message, /Submit separate jobs/)
            return true
        })
        assert.equal(fetch.mock.callCount(), 0)
    })
}
