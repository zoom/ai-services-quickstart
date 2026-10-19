export type UploadPolicy = { maxBytes: number; extensions: readonly string[]; hint: string }
const megabyte = 1024 * 1024
export const scribeUploadPolicy: UploadPolicy = {
    maxBytes: 100 * megabyte,
    extensions: ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'webm', 'mp4', 'mov'],
    hint: 'WAV, MP3, M4A, FLAC, OGG, WebM, MP4, MOV · playground upload limit 100 MB',
}
export const speechUploadPolicy: UploadPolicy = {
    maxBytes: 50 * megabyte,
    extensions: ['wav', 'mp3', 'm4a', 'webm', 'mp4'],
    hint: 'WAV, MP3, M4A, WebM, MP4 · max 50 MB and 2 hours',
}
export function validateUpload(file: { name: string; size: number }, policy: UploadPolicy): string | null {
    if (!file.size) return 'Choose a nonempty recording.'
    if (file.size > policy.maxBytes) return `Recording exceeds the ${policy.maxBytes / megabyte} MB upload limit.`
    if (!policy.extensions.includes(file.name.split('.').pop()?.toLowerCase() ?? '')) return `Choose a supported file: ${policy.extensions.join(', ')}.`
    return null
}
