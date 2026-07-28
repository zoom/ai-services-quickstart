import { z } from 'zod'
import { router, procedure } from '../trpc.ts'
import { ZOOM_API_BASE_URL, createApiRequest } from '../util.ts'
import { filesResponseSchema, jobResponseSchema, listResponseSchema, makeBatchSubmitSchema, resolveJobIO } from './shared.ts'
import { submitBatchJob, type JobTemplate } from './shared.ts'

const makeScribeRequest = createApiRequest(`${ZOOM_API_BASE_URL}/aiservices/scribe`)
const makeScribeBatchRequest = async (path: string, init?: RequestInit) => jobResponseSchema.parse(await makeScribeRequest(path, init))
const batchSubmitSchema = makeBatchSubmitSchema(z.record(z.string(), z.unknown()).optional())

const transcribeResponseSchema = z.object({
    request_id: z.string().optional(),
    duration_sec: z.number().optional(),
    result: z.object({
        text_display: z.string().optional(),
        text_lexical: z.string().optional(),
        segments: z.array(z.object({
            id: z.string(),
            start: z.number(),
            end: z.number(),
            channel: z.number().optional(),
            speaker: z.string().optional(),
            text: z.string(),
            words: z.array(z.object({
                word: z.string(),
                start: z.number(),
                end: z.number(),
            })).optional(),
        })).optional(),
    }).optional(),
    model: z.string().optional(),
    metrics: z.unknown().optional(),
})

export const scribeRouter = router({
    transcribe: procedure
        .input(z.object({
            file: z.string(),
            config: z.object({
                language: z.string(),
                channel_separation: z.boolean(),
            }),
        }))
        .mutation(async ({ input }) => {
            const data = await makeScribeRequest('/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: input.file, config: input.config }),
            })
            return transcribeResponseSchema.parse(data)
        }),

    batch: router({
        submit: procedure
            .input(batchSubmitSchema)
            .mutation(async ({ input }) => {
                const { inputAws, output } = resolveJobIO(input.input, input.output)
                const template: JobTemplate = {
                    output,
                    config: input.config ?? { language: 'en-US' },
                    ...(input.reference_id && { reference_id: input.reference_id }),
                    ...(input.notifications?.webhook_url && { notifications: input.notifications }),
                }
                return submitBatchJob({
                    input: input.input,
                    template,
                    inputAws,
                    makeRequest: makeScribeBatchRequest,
                })
            }),

        list: procedure
            .input(z.object({ stateFilter: z.string().optional() }))
            .query(async ({ input }) => {
                const params = input.stateFilter ? `?state=${input.stateFilter}` : ''
                const data = await makeScribeRequest(`/jobs${params}`)
                return listResponseSchema.parse(data)
            }),

        getStatus: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => {
                const data = await makeScribeRequest(`/jobs/${input.jobId}`)
                return jobResponseSchema.parse(data)
            }),

        getFiles: procedure
            .input(z.object({ jobId: z.string(), next_page_token: z.string().optional() }))
            .mutation(async ({ input }) => {
                const params = input.next_page_token ? `?next_page_token=${encodeURIComponent(input.next_page_token)}` : ''
                const data = await makeScribeRequest(`/jobs/${input.jobId}/files${params}`)
                return filesResponseSchema.parse(data)
            }),

        cancel: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => {
                await makeScribeRequest(`/jobs/${input.jobId}`, { method: 'DELETE' })
                return { status: 'Job canceled successfully.' }
            }),
    }),
})
