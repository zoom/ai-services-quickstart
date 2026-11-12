import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.ZOOM_API_KEY = 'offline-test-key'
process.env.ZOOM_API_SECRET = 'offline-test-secret'
const { appRouter } = await import('../src/routers/index.ts')
const caller = appRouter.createCaller({})

const input = { mode: 'PREFIX' as const, uri: 's3://bucket/input/' }
const configs = {
    scribe: { language: 'en-US', channel_separation: false, diarization: false },
    translator: { target_languages: ['es-ES'] },
    summarizer: { task: 'summary' as const },
}

for (const product of ['scribe', 'translator', 'summarizer'] as const) {
    for (const uri of [undefined, 's3://bucket/stale-output/']) {
        test(`${product}: ADJACENT never forwards output.uri (${uri ? 'explicit' : 'omitted'} URI)`, async t => {
            const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ job_id: 'offline-job', state: 'QUEUED' }))
            await caller[product].batch.submit({ input, output: { layout: 'ADJACENT', uri }, config: configs[product] } as never)
            const sent = JSON.parse(fetchMock.mock.calls[0].arguments[1]?.body as string)
            assert.equal('uri' in sent.output, false)
            assert.equal(sent.output.layout, 'ADJACENT')
            assert.equal(sent.output.destination, 'S3')
            assert.equal(sent.input.uri, input.uri)
        })
    }
}

test('Default ADJACENT also omits the output URI', async t => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ job_id: 'offline-job', state: 'QUEUED' }))
    await caller.scribe.batch.submit({ input })
    const sent = JSON.parse(fetchMock.mock.calls[0].arguments[1]?.body as string)
    assert.equal(sent.output.layout, 'ADJACENT')
    assert.equal('uri' in sent.output, false)
})

for (const layout of ['PREFIX', 'SINGLE']) {
    test(`${layout} output preserves explicit and fallback URIs`, async t => {
        const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ job_id: 'offline-job', state: 'QUEUED' }))
        const singleInput = { mode: 'SINGLE' as const, uri: 's3://bucket/input.wav' }
        await caller.scribe.batch.submit({ input: singleInput, output: { layout, uri: 's3://bucket/output' } })
        await caller.scribe.batch.submit({ input: singleInput, output: { layout } })
        const requests = fetchMock.mock.calls.map(call => JSON.parse(call.arguments[1]?.body as string))
        assert.equal(requests[0].output.uri, 's3://bucket/output')
        assert.equal(requests[1].output.uri, singleInput.uri)
    })
}
