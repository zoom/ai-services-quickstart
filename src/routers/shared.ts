import { z } from 'zod'
import { getEnvAwsCredentials, isS3, withAwsAuth, type ApiRequest } from '../util.ts'
import { procedure, router } from '../trpc.ts'

const awsCredsSchema = z.object({
    access_key_id: z.string(),
    secret_access_key: z.string(),
    session_token: z.string().optional(),
})

const batchOutputSchema = z.object({
    destination: z.string().optional(),
    uri: z.string().optional(),
    layout: z.string().optional(),
    overwrite: z.boolean().optional(),
    auth: z.object({ aws: awsCredsSchema.optional() }).optional(),
})

const notificationsSchema = z.object({
    webhook_url: z.string().optional(),
    secret: z.string().optional(),
})

const batchFiltersSchema = z.object({
    include_globs: z.array(z.string()).optional(),
    exclude_globs: z.array(z.string()).optional(),
}).optional()

const batchInputSchema = z.object({
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

const jobResponseSchema = z.object({
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

const fileSchema = z.object({
    file_id: z.string(),
    input_uri: z.string(),
    output_uri: z.string(),
    state: z.string(),
    duration_sec: z.number().optional(),
    error: apiErrorSchema.optional(),
})

const filesResponseSchema = z.object({
    files: z.array(fileSchema),
    next_cursor: z.string().optional(),
})

const listResponseSchema = z.object({
    jobs: z.array(z.object({
        job_id: z.string(),
        state: z.string(),
        submitted_at: z.string().optional(),
    })),
    next_cursor: z.string().optional(),
})

type BatchInput = z.infer<typeof batchInputSchema>
type BatchOutput = z.infer<typeof batchOutputSchema>

// Fill output defaults and attach env AWS credentials to S3 input/output when none were sent.
function resolveJobIO(input: BatchInput | undefined, output: BatchOutput | undefined) {
    const envAws = getEnvAwsCredentials()
    const inputSource = input?.source ?? (input?.uri?.startsWith('s3://') ? 'S3' : undefined)
    const inputAws = isS3(inputSource) ? (input?.auth?.aws ?? envAws) : undefined

    const outputBase: BatchOutput = {
        destination: output?.destination ?? 'S3',
        uri: output?.uri ?? input?.uri,
        layout: output?.layout ?? 'ADJACENT',
        overwrite: output?.overwrite ?? false,
        ...(output?.auth && { auth: output.auth }),
    }
    const outputAws = isS3(outputBase.destination) ? (outputBase.auth?.aws ?? envAws) : undefined

    return { input: withAwsAuth(input, inputAws), output: withAwsAuth(outputBase, outputAws) }
}

const submitSchema = z.object({
    input: batchInputSchema.optional(),
    output: batchOutputSchema.optional(),
    reference_id: z.string().optional(),
    notifications: notificationsSchema.optional(),
})

// The batch job API is identical across AI services; only the config schema differs.
export function makeBatchRouter<TConfig extends z.ZodType>(makeRequest: ApiRequest, configSchema: TConfig, defaultConfig?: Record<string, unknown>) {
    return router({
        submit: procedure
            .input(submitSchema.extend({ config: configSchema }))
            .mutation(async ({ input: raw }) => {
                // zod can't infer through the generic config; the base fields are what we read here.
                const values = raw as z.infer<typeof submitSchema> & { config?: unknown }
                const { input, output } = resolveJobIO(values.input, values.output)
                const data = await makeRequest('/jobs', {
                    json: {
                        ...(input && { input }),
                        output,
                        config: values.config ?? defaultConfig,
                        ...(values.reference_id && { reference_id: values.reference_id }),
                        ...(values.notifications?.webhook_url && { notifications: values.notifications }),
                    },
                })
                return jobResponseSchema.parse(data)
            }),

        list: procedure
            .input(z.object({ stateFilter: z.string().optional() }))
            .query(async ({ input }) => {
                const params = input.stateFilter ? `?state=${encodeURIComponent(input.stateFilter)}` : ''
                return listResponseSchema.parse(await makeRequest(`/jobs${params}`))
            }),

        getStatus: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => jobResponseSchema.parse(await makeRequest(`/jobs/${encodeURIComponent(input.jobId)}`))),

        getFiles: procedure
            .input(z.object({ jobId: z.string(), next_page_token: z.string().optional() }))
            .mutation(async ({ input }) => {
                const params = input.next_page_token ? `?next_page_token=${encodeURIComponent(input.next_page_token)}` : ''
                return filesResponseSchema.parse(await makeRequest(`/jobs/${encodeURIComponent(input.jobId)}/files${params}`))
            }),

        cancel: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => {
                await makeRequest(`/jobs/${encodeURIComponent(input.jobId)}`, { method: 'DELETE' })
                return { status: 'Job canceled successfully.' }
            }),
    })
}
