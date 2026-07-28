import { z } from 'zod'
import { router, procedure } from '../trpc.js'
import { createApiRequest, ZOOM_API_BASE_URL } from '../util.js'
import { filesResponseSchema, jobResponseSchema, listResponseSchema, makeBatchSubmitSchema, resolveJobIO } from './shared.js'
import { submitBatchJob, type JobTemplate } from './shared.js'

const makeSummarizerRequest = createApiRequest(`${ZOOM_API_BASE_URL}/aiservices/summarizer`)
const makeSummarizerBatchRequest = async (path: string, init?: RequestInit) => jobResponseSchema.parse(await makeSummarizerRequest(path, init))

const MAX_TEXT_BYTES = 96 * 1024

const supportedLanguages = ['en-us', 'zh-cn', 'ja-jp', 'es-es', 'fr-fr', 'de-de', 'pt-br', 'it-it', 'ar-sa', 'ar-ae'] as const
const supportedTasks = ['recap', 'action_items', 'summary', 'full_summary'] as const
const supportedSummaryTypes = ['conversation'] as const

function omitEmptyStrings<T extends Record<string, unknown>>(value: T): Partial<T> {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== '')) as Partial<T>
}

const summarizerFastConfigSchema = z.object({
    task: z.enum(supportedTasks),
    language: z.enum(supportedLanguages).default('en-us'),
    summary_type: z.enum(supportedSummaryTypes).default('conversation'),
})

const summarizerBatchConfigSchema = summarizerFastConfigSchema

const batchSubmitSchema = makeBatchSubmitSchema(summarizerBatchConfigSchema)

const summarizeResponseSchema = z.object({
    request_id: z.string().optional(),
    task: z.enum(supportedTasks).optional(),
    result: z.object({
        text: z.string().optional(),
        recap: z.string().optional(),
        summary_text: z.string().optional(),
        action_items: z.string().optional(),
    }).optional(),
    model: z.string().optional(),
    usage: z.unknown().optional(),
}).catchall(z.unknown())

export const summarizerRouter = router({
    summarize: procedure
        .input(z.object({
            input: z.object({
                text: z.string().min(1).refine(
                    text => new TextEncoder().encode(text).length <= MAX_TEXT_BYTES,
                    `Input text must be 96 KB or less.`
                ),
            }),
            config: summarizerFastConfigSchema,
        }))
        .mutation(async ({ input }) => {
            const data = await makeSummarizerRequest('/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
            return summarizeResponseSchema.parse(data)
        }),

    batch: router({
        submit: procedure
            .input(batchSubmitSchema)
            .mutation(async ({ input }) => {
                const { inputAws, output } = resolveJobIO(input.input, input.output)
                const config = omitEmptyStrings(input.config)
                const template: JobTemplate = {
                    output,
                    config,
                    ...(input.reference_id && { reference_id: input.reference_id }),
                    ...(input.notifications?.webhook_url && { notifications: input.notifications }),
                }
                return submitBatchJob({
                    input: input.input,
                    template,
                    inputAws,
                    makeRequest: makeSummarizerBatchRequest,
                })
            }),

        list: procedure
            .input(z.object({ stateFilter: z.string().optional() }))
            .query(async ({ input }) => {
                const params = input.stateFilter ? `?state=${input.stateFilter}` : ''
                const data = await makeSummarizerRequest(`/jobs${params}`)
                return listResponseSchema.parse(data)
            }),

        getStatus: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => {
                const data = await makeSummarizerRequest(`/jobs/${input.jobId}`)
                return jobResponseSchema.parse(data)
            }),

        getFiles: procedure
            .input(z.object({ jobId: z.string(), next_page_token: z.string().optional() }))
            .mutation(async ({ input }) => {
                const params = input.next_page_token ? `?next_page_token=${encodeURIComponent(input.next_page_token)}` : ''
                const data = await makeSummarizerRequest(`/jobs/${input.jobId}/files${params}`)
                return filesResponseSchema.parse(data)
            }),

        cancel: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => {
                await makeSummarizerRequest(`/jobs/${input.jobId}`, { method: 'DELETE' })
                return { status: 'Job canceled successfully.' }
            }),
    }),
})
