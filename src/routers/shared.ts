import { z } from 'zod'
import { parseApiResponse } from '../responses.ts'
import { getEnvAwsCredentials, isS3, withAwsAuth, type ApiRequest } from '../util.ts'
import { procedure, router } from '../trpc.ts'
import { TRPCError } from '@trpc/server'
import { batchManifestError } from '../config/batchManifest.ts'

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
    manifest: z.array(z.string().trim().min(1)).min(1).max(1000).optional(),
    filters: batchFiltersSchema,
    auth: z.object({ aws: awsCredsSchema.optional() }).optional(),
}).superRefine((input, ctx) => {
    if (input.mode === 'MANIFEST') {
        const error = batchManifestError(input.manifest ?? [])
        if (error) ctx.addIssue({ code: 'custom', path: ['manifest'], message: error })
    }
    if (input.mode !== 'MANIFEST' && !input.uri?.trim()) ctx.addIssue({ code: 'custom', path: ['uri'], message: 'An input URI is required.' })
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
    output_uri: z.string().nullable().optional(),
    state: z.string(),
    duration_sec: z.number().optional(),
    usage: z.unknown().optional(),
    error: apiErrorSchema.optional(),
})

const filesResponseSchema = z.object({
    files: z.array(fileSchema),
    next_cursor: z.string().nullable().optional(),
})

const listResponseSchema = z.object({
    jobs: z.array(z.object({
        job_id: z.string(),
        state: z.string(),
        submitted_at: z.string().optional(),
    })),
    next_cursor: z.string().nullable().optional(),
})

type BatchInput = z.infer<typeof batchInputSchema>
type BatchOutput = z.infer<typeof batchOutputSchema>

// Fill output defaults and attach env AWS credentials to S3 input/output when none were sent.
function resolveJobIO(input: BatchInput | undefined, output: BatchOutput | undefined) {
    const envAws = getEnvAwsCredentials()
    const inputSource = input?.source ?? (input?.uri?.startsWith('s3://') ? 'S3' : undefined)
    const inputAws = isS3(inputSource) ? (input?.auth?.aws ?? envAws) : undefined

    const layout = output?.layout ?? 'ADJACENT'
    const outputBase: BatchOutput = {
        destination: output?.destination ?? 'S3',
        ...(layout !== 'ADJACENT' && { uri: output?.uri ?? input?.uri }),
        layout,
        overwrite: output?.overwrite ?? false,
        ...(output?.auth && { auth: output.auth }),
    }
    const outputAws = isS3(outputBase.destination) && !outputBase.uri?.startsWith('https://') ? (outputBase.auth?.aws ?? envAws) : undefined

    return { input: withAwsAuth(input, inputAws), output: withAwsAuth(outputBase, outputAws) }
}

const submitSchema = z.object({
    input: batchInputSchema.optional(),
    output: batchOutputSchema.optional(),
    reference_id: z.string().optional(),
    notifications: notificationsSchema.optional(),
})

// The batch job API is identical across AI services; only the config schema differs.
// `toBody` maps the playground config onto request fields; by default it's sent as `config`.
export function makeBatchRouter<TConfig extends z.ZodType>(
    makeRequest: ApiRequest,
    configSchema: TConfig,
    defaultConfig?: z.infer<TConfig>,
    toBody: (config: z.infer<TConfig> | undefined) => Record<string, unknown> = config => ({ config }),
    options: { singleOutput?: boolean } = {},
) {
    return router({
        submit: procedure
            .input(submitSchema.extend({ config: configSchema }))
            .mutation(async ({ input: raw }) => {
                // zod can't infer through the generic config; the base fields are what we read here.
                const values = raw as z.infer<typeof submitSchema> & { config?: z.infer<TConfig> }
                if (values.output?.layout === 'SINGLE' && (!options.singleOutput || values.input?.mode !== 'SINGLE')) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Single-file output is supported only for Scribe with SINGLE input.' })
                }
                const { input, output } = resolveJobIO(values.input, values.output)
                const data = await makeRequest('/jobs', {
                    json: {
                        ...(input && { input }),
                        output,
                        ...toBody(values.config ?? defaultConfig),
                        ...(values.reference_id && { reference_id: values.reference_id }),
                        ...(values.notifications?.webhook_url && { notifications: values.notifications }),
                    },
                })
                return parseApiResponse(jobResponseSchema, data)
            }),

        list: procedure
            .input(z.object({ stateFilter: z.string().optional(), next_page_token: z.string().optional(), page_size: z.number().int().min(1).max(200).optional() }))
            .query(async ({ input }) => {
                const params = new URLSearchParams()
                if (input.stateFilter) params.set('state', input.stateFilter)
                if (input.next_page_token) params.set('next_page_token', input.next_page_token)
                if (input.page_size) params.set('page_size', String(input.page_size))
                return parseApiResponse(listResponseSchema, await makeRequest(`/jobs${params.size ? `?${params}` : ''}`))
            }),

        getStatus: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => parseApiResponse(jobResponseSchema, await makeRequest(`/jobs/${encodeURIComponent(input.jobId)}`))),

        getFiles: procedure
            .input(z.object({ jobId: z.string(), next_page_token: z.string().optional() }))
            .mutation(async ({ input }) => {
                const params = input.next_page_token ? `?next_page_token=${encodeURIComponent(input.next_page_token)}` : ''
                return parseApiResponse(filesResponseSchema, await makeRequest(`/jobs/${encodeURIComponent(input.jobId)}/files${params}`))
            }),

        getFile: procedure
            .input(z.object({ jobId: z.string().min(1), fileId: z.string().min(1) }))
            .mutation(async ({ input }) => parseApiResponse(fileSchema, await makeRequest(`/jobs/${encodeURIComponent(input.jobId)}/files/${encodeURIComponent(input.fileId)}`))),

        cancel: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => {
                await makeRequest(`/jobs/${encodeURIComponent(input.jobId)}`, { method: 'DELETE' })
                return { status: 'Job canceled successfully.' }
            }),
    })
}
