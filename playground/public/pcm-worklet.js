// AudioWorklet that converts the mic's Float32 samples into 16-bit little-endian
// PCM and posts ~100 ms chunks (1600 samples @ 16 kHz) back to the main thread.
// The AudioContext is created at 16 kHz, so the samples reaching here are already
// resampled — we only need Float32 -> Int16 conversion and framing.
// Samples are written straight into a preallocated frame, so this realtime thread
// allocates once per 100 ms frame instead of on every 128-sample render quantum.
const FRAME_SAMPLES = 1600; // 100 ms at 16 kHz

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frame = new Int16Array(FRAME_SAMPLES);
    this._length = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]));
        this._frame[this._length++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this._length === FRAME_SAMPLES) {
          // Transfer the buffer to avoid a copy, then start a fresh frame.
          this.port.postMessage(this._frame.buffer, [this._frame.buffer]);
          this._frame = new Int16Array(FRAME_SAMPLES);
          this._length = 0;
        }
      }
    }
    return true; // keep the processor alive
  }
}

registerProcessor("pcm-processor", PCMProcessor);
