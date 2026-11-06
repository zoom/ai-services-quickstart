// Network chunks may split a PCM16 sample. Keep its first byte until the next read.
export class PcmDecoder {
    private pending: number | null = null
    decode(bytes: Uint8Array): Float32Array<ArrayBuffer> {
        const joined = new Uint8Array(bytes.length + (this.pending === null ? 0 : 1))
        if (this.pending !== null) joined[0] = this.pending
        joined.set(bytes, this.pending === null ? 0 : 1)
        this.pending = joined.length % 2 ? joined[joined.length - 1] : null
        const view = new DataView(joined.buffer)
        return Float32Array.from({ length: Math.floor(joined.length / 2) }, (_, i) => view.getInt16(i * 2, true) / 32768)
    }
    finish() {
        if (this.pending !== null) throw new Error('Audio ended with an incomplete PCM16 sample.')
    }
}

export function toBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(binary)
}

export function fromBase64(value: string) {
    return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

export function pcmWav(chunks: Uint8Array[], sampleRate: number): Blob {
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
    if (length % 2) throw new Error('Audio ended with an incomplete PCM16 sample.')
    const header = new ArrayBuffer(44)
    const view = new DataView(header)
    const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
    text(0, 'RIFF'); view.setUint32(4, length + 36, true); text(8, 'WAVE'); text(12, 'fmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, length, true)
    return new Blob([header, ...chunks.map(chunk => new Uint8Array(chunk))], { type: 'audio/wav' })
}

export class PcmPlayer {
    private decoder = new PcmDecoder()
    private playhead = 0
    private sources = new Set<AudioBufferSourceNode>()
    private context: AudioContext
    private sampleRate: number
    constructor(context: AudioContext, sampleRate: number) {
        this.context = context
        this.sampleRate = sampleRate
    }
    append(bytes: Uint8Array) {
        const samples = this.decoder.decode(bytes)
        if (!samples.length) return
        const buffer = this.context.createBuffer(1, samples.length, this.sampleRate)
        buffer.copyToChannel(samples, 0)
        const source = this.context.createBufferSource()
        source.buffer = buffer
        source.connect(this.context.destination)
        this.sources.add(source)
        source.onended = () => { this.sources.delete(source); source.disconnect() }
        const at = Math.max(this.context.currentTime + 0.02, this.playhead)
        source.start(at)
        this.playhead = at + buffer.duration
    }
    finish() { this.decoder.finish() }
    stop() {
        this.sources.forEach(source => { try { source.stop() } catch { /* Already ended. */ } source.disconnect() })
        this.sources.clear()
    }
}
