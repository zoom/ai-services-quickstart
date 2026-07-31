import { z } from 'zod'
import { getEnvAwsCredentials, isS3, withAwsAuth } from '../util.ts'
import type { AwsCredentials } from '../util.ts'

export function makeBatchSubmitSchema<TConfig extends z.ZodTypeAny>(configSchema: TConfig) {
    return z.object({
        input: batchInputSchema.optional(),
        output: batchOutputSchema.optional(),
        config: configSchema,
        reference_id: z.string().optional(),
        notifications: notificationsSchema.optional(),
    })
}
export async function submitBatchJob({
    input,
    template,
    inputAws,
    makeRequest,
}: {
    input: BatchInputLike | undefined
    template: JobTemplate
    inputAws?: AwsCredentials
    makeRequest: (path: string, init?: RequestInit) => Promise<JobResponse>
}): Promise<JobResponse> {
    const inputWithAuth = withAwsAuth(input, inputAws)
    return makeRequest('/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(inputWithAuth && { input: inputWithAuth }), ...template }),
    })
}

export function resolveJobIO(
    input: BatchInputLike | undefined,
    output: BatchOutputLike | undefined,
): { inputAws: AwsCredentials | undefined; output: BatchOutputLike | undefined } {
    const envAws = getEnvAwsCredentials()
    const inputSource = input?.source ?? (input?.uri?.startsWith('s3://') ? 'S3' : undefined)
    const inputAws = isS3(inputSource) ? (input?.auth?.aws ?? envAws) : undefined

    const outputBase: BatchOutputLike = {
        destination: output?.destination ?? 'S3',
        uri: output?.uri ?? input?.uri,
        layout: output?.layout ?? 'ADJACENT',
        overwrite: output?.overwrite ?? false,
        ...(output?.auth && { auth: output.auth }),
    }
    const outputAws = isS3(outputBase.destination) ? (outputBase.auth?.aws ?? envAws) : undefined

    return { inputAws, output: withAwsAuth(outputBase, outputAws) }
}

export const awsCredsSchema = z.object({
    access_key_id: z.string(),
    secret_access_key: z.string(),
    session_token: z.string().optional(),
})

export const batchOutputSchema = z.object({
    destination: z.string().optional(),
    uri: z.string().optional(),
    layout: z.string().optional(),
    overwrite: z.boolean().optional(),
    auth: z.object({ aws: awsCredsSchema.optional() }).optional(),
})

export const notificationsSchema = z.object({
    webhook_url: z.string().optional(),
    secret: z.string().optional(),
})

export const batchFiltersSchema = z.object({
    include_globs: z.array(z.string()).optional(),
    exclude_globs: z.array(z.string()).optional(),
}).optional()

export const batchInputSchema = z.object({
    source: z.string().optional(),
    mode: z.enum(['SINGLE', 'PREFIX', 'MANIFEST']),
    uri: z.string().optional(),
    manifest: z.array(z.string()).optional(),
    filters: batchFiltersSchema,
    auth: z.object({ aws: awsCredsSchema.optional() }).optional(),
})

const apiErrorSchema = z.object({
    code: z.string().optional(),
    message: z.string().optional(),
    details: z.unknown().optional(),
}).nullable()

const jobStatsSchema = z.object({
    total_files: z.number().optional(),
    queued: z.number().optional(),
    processing: z.number().optional(),
    succeeded: z.number().optional(),
    failed: z.number().optional(),
    skipped: z.number().optional(),
    canceled: z.number().optional(),
}).catchall(z.number().optional())

const jobInputSchema = z.object({
    mode: z.string(),
    source: z.string().optional().nullable(),
    uri: z.string().optional().nullable(),
    manifest: z.array(z.string()).optional().nullable(),
    filters: z.unknown().nullable().optional(),
    auth: z.unknown().nullable().optional(),
}).optional().nullable()

const jobOutputSchema = z.object({
    destination: z.string(),
    uri: z.string(),
    layout: z.string(),
    overwrite: z.boolean(),
    auth: z.unknown().nullable().optional(),
}).optional().nullable()

export const jobResponseSchema = z.object({
    job_id: z.string(),
    state: z.string(),
    reference_id: z.string().optional(),
    submitted_at: z.string().optional(),
    completed_at: z.string().optional(),
    input: jobInputSchema,
    output: jobOutputSchema,
    config: z.record(z.string(), z.unknown()).optional().nullable(),
    summary: jobStatsSchema.optional().nullable(),
    stats: jobStatsSchema.optional().nullable(),
    error: apiErrorSchema.optional(),
    status: z.string().optional(),
})

export type JobResponse = z.infer<typeof jobResponseSchema>

const fileSchema = z.object({
    file_id: z.string(),
    input_uri: z.string(),
    output_uri: z.string(),
    state: z.string(),
    duration_sec: z.number().optional(),
    error: apiErrorSchema.optional(),
})

export const filesResponseSchema = z.object({
    files: z.array(fileSchema),
    next_cursor: z.string().optional(),
})

export const listResponseSchema = z.object({
    jobs: z.array(z.object({
        job_id: z.string(),
        state: z.string(),
        submitted_at: z.string().optional(),
    })),
    next_cursor: z.string().optional(),
})

export type BatchInputLike = {
    source?: string
    mode?: 'SINGLE' | 'PREFIX' | 'MANIFEST'
    uri?: string
    manifest?: string[]
    filters?: {
        include_globs?: string[]
        exclude_globs?: string[]
    }
    auth?: { aws?: AwsCredentials }
}

export type BatchOutputLike = {
    destination?: string
    uri?: string
    layout?: string
    overwrite?: boolean
    auth?: { aws?: AwsCredentials }
}

export type JobTemplate = {
    output: BatchOutputLike | undefined
    config: Record<string, unknown>
    reference_id?: string
    notifications?: { webhook_url?: string; secret?: string }
}
