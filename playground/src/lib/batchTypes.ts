import type { RouterOutputs } from './trpc'

// Every product's batch router is built by the same factory, so their outputs match.
type BatchOutputs = RouterOutputs['scribe']['batch']

export type JobResponse = BatchOutputs['getStatus']
export type FilesResponse = BatchOutputs['getFiles']
export type FileResponse = BatchOutputs['getFile']
export type CancelResponse = BatchOutputs['cancel']
export type Job = BatchOutputs['list']['jobs'][number]
// Created client-side from a failed mutation, or a job carrying an API error.
export type ErrorResponse = { error: string | { code?: string; message?: string } }

export type BatchApiResponse = ErrorResponse | FilesResponse | FileResponse | JobResponse | CancelResponse

export function isErrorResponse(d: BatchApiResponse): d is ErrorResponse {
    return 'error' in d && d.error != null
}

export function isFilesResponse(d: BatchApiResponse): d is FilesResponse {
    return 'files' in d && Array.isArray(d.files)
}

export function isJobResponse(d: BatchApiResponse): d is JobResponse {
    return 'job_id' in d && typeof d.job_id === 'string' && !isFileResponse(d)
}

export function isFileResponse(d: BatchApiResponse): d is FileResponse {
    return 'file_id' in d && typeof d.file_id === 'string'
}
