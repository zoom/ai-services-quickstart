import type { RouterInputs } from '../../../lib/trpc'

export type AsrConfig = RouterInputs['scribe']['transcribe']['config']

export const defaultAsrConfig: AsrConfig = {
    language: 'en-US',
    channel_separation: false,
    diarization: false,
}
