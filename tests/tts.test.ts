import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test, type TestContext } from 'node:test'
import express from 'express'
import { ttsInputSchema } from '../src/config/tts.ts'
import { PcmDecoder, pcmWav } from '../playground/src/lib/pcm.ts'

process.env.ZOOM_API_KEY = 'offline-test-key'
process.env.ZOOM_API_SECRET = 'offline-test-secret'
const { ttsHandler, ttsJson } = await import('../src/routers/tts.ts')
const { ZOOM_API_BASE_URL } = await import('../src/util.ts')
const nativeFetch = globalThis.fetch
const pcmType = 'audio/pcm;rate=44100;bits=16;channels=1;encoding=signed-int;endian=little'

async function serverFor(t: TestContext) {
    const app = express()
    app.post('/api/tts', ttsJson, ttsHandler)
    const server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }))
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    return (body: string, signal?: AbortSignal, type = 'application/json') => nativeFetch(`http://127.0.0.1:${address.port}/api/tts`, {
        method: 'POST', headers: { 'Content-Type': type }, body, signal,
    })
}

test('TTS counts Unicode code points and enforces exact documented controls', () => {
    assert.ok(ttsInputSchema.safeParse({ input: '😀'.repeat(4000), voice: 'JENNA', speed: 0.5, volume: 10 }).success)
    for (const patch of [
        { input: '😀'.repeat(4001) }, { input: ' \n ' }, { voice: 'unknown' }, { speed: 0.49 },
        { speed: 2.01 }, { volume: 0 }, { volume: 10.01 }, { language: 'en-US' }, { model: 'tts' },
        { response_format: 'pcm_16000' }, { voice: null }, { config: {} },
    ]) assert.equal(ttsInputSchema.safeParse({ input: 'Hello', ...patch }).success, false)
})

test('TTS rejects invalid requests and oversized raw escaped JSON before an upstream call', async t => {
    const post = await serverFor(t)
    const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected upstream request') })
    assert.equal((await post(JSON.stringify({ input: 'Hello', language: 'en-US' }))).status, 400)
    assert.equal((await post('{')).status, 400)
    assert.equal((await post('hello', undefined, 'text/plain')).status, 415)
    // Only 3,000 decoded code points, but the escaped raw body exceeds 32 KiB.
    assert.equal((await post('{"input":"' + '\\ud83d\\ude00'.repeat(3000) + '"}')).status, 413)
    assert.equal(mock.mock.callCount(), 0)
})

test('TTS streams ordered raw PCM, uses top-level JSON and retains tracking headers', async t => {
    const post = await serverFor(t)
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        assert.equal(url, `${ZOOM_API_BASE_URL}/aiservices/tts/synthesize`)
        assert.match((init?.headers as Record<string, string>).Authorization, /^Bearer /)
        assert.deepEqual(JSON.parse(init?.body as string), { input: 'Hello', voice: 'jenna', speed: 1, volume: 1, response_format: 'pcm_44100' })
        return new Response(new ReadableStream({ start(controller) {
            controller.enqueue(new Uint8Array([0, 128, 255]))
            controller.enqueue(new Uint8Array([127, 0, 0]))
            controller.close()
        } }), { headers: { 'Content-Type': pcmType, 'x-zm-trackingid': 'req-test' } })
    })
    const response = await post(JSON.stringify({ input: 'Hello', voice: 'JENNA', speed: 1, volume: 1, response_format: 'pcm_44100' }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-zm-trackingid'), 'req-test')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([0, 128, 255, 127, 0, 0]))
})

test('TTS preserves upstream error status, reason, tracking ID and retry delay', async t => {
    const post = await serverFor(t)
    t.mock.method(globalThis, 'fetch', async () => Response.json({ code: 503, reason: 'SERVICE_UNAVAILABLE', message: 'Try again' }, {
        status: 503, headers: { 'retry-after': '10', 'x-zm-trackingid': 'req-error' },
    }))
    const response = await post('{"input":"Hello"}')
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('retry-after'), '10')
    assert.equal(response.headers.get('x-zm-trackingid'), 'req-error')
    assert.equal((await response.json()).details.reason, 'SERVICE_UNAVAILABLE')
})

test('TTS aborts partial HTTP output when upstream audio fails', async t => {
    const post = await serverFor(t)
    let audio!: ReadableStreamDefaultController<Uint8Array>
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) {
        audio = controller
        controller.enqueue(new Uint8Array([0, 0]))
    } }), { headers: { 'Content-Type': pcmType } }))
    const response = await post('{"input":"Hello"}')
    const reader = response.body!.getReader()
    assert.equal((await reader.read()).value?.length, 2)
    audio.error(new Error('Synthesis interrupted'))
    await assert.rejects(reader.read())
})

test('TTS client cancellation aborts upstream synthesis', async t => {
    const post = await serverFor(t)
    let aborted!: Promise<void>
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
        aborted = new Promise(resolve => init!.signal!.addEventListener('abort', () => resolve(), { once: true }))
        return new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([0, 0])) } }), { headers: { 'Content-Type': pcmType } })
    })
    const controller = new AbortController()
    const response = await post('{"input":"Hello"}', controller.signal)
    await response.body!.getReader().read()
    controller.abort()
    await aborted
})

test('PCM decoding carries incomplete samples across arbitrary network boundaries', () => {
    const decoder = new PcmDecoder()
    assert.deepEqual([...decoder.decode(new Uint8Array([0]))], [])
    assert.deepEqual([...decoder.decode(new Uint8Array([128, 255, 127, 0]))], [-1, 32767 / 32768])
    assert.deepEqual([...decoder.decode(new Uint8Array([0]))], [0])
    decoder.finish()
    decoder.decode(new Uint8Array([1]))
    assert.throws(() => decoder.finish(), /incomplete/)
})

test('WAV downloads describe PCM16 mono at the correct rate and contain all bytes', async () => {
    const data = new Uint8Array(await pcmWav([new Uint8Array([0, 128, 255]), new Uint8Array([127])], 44100).arrayBuffer())
    const header = new DataView(data.buffer)
    assert.equal(new TextDecoder().decode(data.slice(0, 4)), 'RIFF')
    assert.equal(header.getUint32(4, true), 40)
    assert.equal(header.getUint16(22, true), 1)
    assert.equal(header.getUint32(24, true), 44100)
    assert.equal(header.getUint32(28, true), 88200)
    assert.equal(header.getUint16(34, true), 16)
    assert.equal(header.getUint32(40, true), 4)
    assert.deepEqual([...data.slice(44)], [0, 128, 255, 127])
    assert.throws(() => pcmWav([new Uint8Array([1])], 44100), /incomplete/)
})

