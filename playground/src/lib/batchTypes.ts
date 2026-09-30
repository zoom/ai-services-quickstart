import type { RouterOutputs } from './trpc'

// Every product's batch router is built by the same factory, so their outputs match.
type BatchOutputs = RouterOutputs['scribe']['batch']

export type JobResponse = BatchOutputs['getStatus']
export type FilesResponse = BatchOutputs['getFiles']
export type CancelResponse = BatchOutputs['cancel']
export type Job = BatchOutputs['list']['jobs'][number]
// Created client-side from a failed mutation, or a job carrying an API error.
export type ErrorResponse = { error: string | { code?: string; message?: string } }

export type BatchApiResponse = ErrorResponse | FilesResponse | JobResponse | CancelResponse

export function isErrorResponse(d: BatchApiResponse): d is ErrorResponse {
    return 'error' in d && d.error != null
}

export function isFilesResponse(d: BatchApiResponse): d is FilesResponse {
    return 'files' in d
}

export function isJobResponse(d: BatchApiResponse): d is JobResponse {
    return 'job_id' in d
}
