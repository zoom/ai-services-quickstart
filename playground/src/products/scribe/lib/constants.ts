export type AsrConfig = {
    language: string
    channel_separation: boolean
    diarization: boolean
}

export const defaultAsrConfig: AsrConfig = {
    language: 'en-US',
    channel_separation: false,
    diarization: false,
}
