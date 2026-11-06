import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import { audioAppend, sessionUpdate, voicesForLanguage } from '../playground/src/products/interpreter/lib/protocol.ts'

test('Interpreter uses its own session contract, optional transcription and target voice rules', () => {
    const options = { source: 'en-US', target: 'es-ES', voice: 'jenna', transcription: true }
    assert.deepEqual(sessionUpdate(options), {
        type: 'session.update', session: { audio: { input: { language: 'en-US', transcription: {} }, output: { language: 'es-ES', voice: 'jenna' } } },
    })
    assert.equal('transcription' in sessionUpdate({ ...options, transcription: false }).session.audio.input, false)
    assert.throws(() => sessionUpdate({ ...options, target: 'en-US' }), /different/)
    assert.deepEqual(voicesForLanguage('ja-JP'), ['brooke', 'hazel', 'reid'])
    assert.throws(() => sessionUpdate({ ...options, target: 'ja-JP' }), /supported voice/)
    assert.throws(() => sessionUpdate({ ...options, voice: 'ava' }), /supported voice/)
    assert.equal(voicesForLanguage('es-ES').length, 9)
    assert.deepEqual(audioAppend(new Uint8Array([0, 128, 255, 127]).buffer), { type: 'session.input_audio_buffer.append', audio: 'AID/fw==' })
    for (const size of [0, 1, 16002]) assert.throws(() => audioAppend(new ArrayBuffer(size)), /PCM16/)
    assert.ok(audioAppend(new ArrayBuffer(16000)))
})

test('Microphone worklet flushes the partial final frame before acknowledging finish', async () => {
    const messages: unknown[] = []
    let Processor!: new () => { process(inputs: Float32Array[][]): boolean; port: { onmessage: (event: { data: { type: string } }) => void } }
    const context = vm.createContext({
        AudioWorkletProcessor: class { port = { postMessage: (data: unknown) => messages.push(data), onmessage: null } },
        registerProcessor: (_name: string, implementation: typeof Processor) => { Processor = implementation },
    })
    vm.runInContext(await readFile(new URL('../playground/public/pcm-worklet.js', import.meta.url), 'utf8'), context)
    const processor = new Processor()
    processor.process([[new Float32Array([0, -1, 1])]])
    assert.equal(messages.length, 0)
    processor.port.onmessage({ data: { type: 'flush' } })
    assert.deepEqual([...new Int16Array(messages[0] as ArrayBuffer)], [0, -32768, 32767])
    assert.equal((messages[1] as { type: string }).type, 'flushed')
    processor.process([[new Float32Array(1600)]])
    processor.port.onmessage({ data: { type: 'flush' } })
    assert.equal(messages.length, 2)
})
