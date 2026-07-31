// AudioWorklet that converts the mic's Float32 samples into 16-bit little-endian
// PCM and posts ~100 ms chunks (1600 samples @ 16 kHz) back to the main thread.
// The AudioContext is created at 16 kHz, so the samples reaching here are already
// resampled — we only need Float32 -> Int16 conversion and framing.
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(0);
    this._target = 1600; // 100 ms at 16 kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const ch = input[0];

      // Append the new samples to the leftover buffer.
      const merged = new Float32Array(this._buf.length + ch.length);
      merged.set(this._buf, 0);
      merged.set(ch, this._buf.length);
      this._buf = merged;

      // Emit as many full 100 ms frames as we have.
      while (this._buf.length >= this._target) {
        const frame = this._buf.subarray(0, this._target);
        const pcm = new Int16Array(this._target);
        for (let i = 0; i < this._target; i++) {
          let s = frame[i];
          if (s > 1) s = 1;
          else if (s < -1) s = -1;
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        // Transfer the buffer to avoid a copy.
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this._buf = this._buf.slice(this._target);
      }
    }
    return true; // keep the processor alive
  }
}

registerProcessor("pcm-processor", PCMProcessor);
