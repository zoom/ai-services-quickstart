import { z } from 'zod'
import { router, procedure } from '../trpc.ts'
import { ZOOM_API_BASE_URL, createApiRequest } from '../util.ts'
import { filesResponseSchema, jobResponseSchema, listResponseSchema, makeBatchSubmitSchema, resolveJobIO } from './shared.ts'
import { submitBatchJob, type JobTemplate } from './shared.ts'

const makeTranslatorRequest = createApiRequest(`${ZOOM_API_BASE_URL}/aiservices/translator`)
const makeTranslatorBatchRequest = async (path: string, init?: RequestInit) => jobResponseSchema.parse(await makeTranslatorRequest(path, init))

const languageCodes = ['en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR', 'it-IT'] as const
const translatorConfigSchema = z.object({ source_language: z.enum(languageCodes), target_languages: z.array(z.enum(languageCodes)).min(1).max(1), })

const translateResponseSchema = z.object({
    request_id: z.string().optional(),
    result: z.object({
        translations: z.record(z.string(), z.string()).optional(),
    }).optional(),
    model: z.string().optional(),
})

export const translatorRouter = router({
    translate: procedure
        .input(z.object({
            text: z.string().min(1).max(4000),
            config: translatorConfigSchema,
        }))
        .mutation(async ({ input }) => {
            const data = await makeTranslatorRequest('/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: input.text, config: input.config }),
            })
            return translateResponseSchema.parse(data)
        }),

    batch: router({
        submit: procedure
            .input(makeBatchSubmitSchema(translatorConfigSchema))
            .mutation(async ({ input }) => {
                const { inputAws, output } = resolveJobIO(input.input, input.output)
                const template: JobTemplate = {
                    output,
                    config: input.config,
                    ...(input.reference_id && { reference_id: input.reference_id }),
                    ...(input.notifications?.webhook_url && { notifications: input.notifications }),
                }
                return submitBatchJob({
                    input: input.input,
                    template,
                    inputAws,
                    makeRequest: makeTranslatorBatchRequest,
                })
            }),

        list: procedure
            .input(z.object({ stateFilter: z.string().optional() }))
            .query(async ({ input }) => {
                const params = input.stateFilter ? `?state=${input.stateFilter}` : ''
                const data = await makeTranslatorRequest(`/jobs${params}`)
                return listResponseSchema.parse(data)
            }),

        getStatus: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => {
                const data = await makeTranslatorRequest(`/jobs/${input.jobId}`)
                return jobResponseSchema.parse(data)
            }),

        getFiles: procedure
            .input(z.object({ jobId: z.string(), next_page_token: z.string().optional() }))
            .mutation(async ({ input }) => {
                const params = input.next_page_token ? `?next_page_token=${encodeURIComponent(input.next_page_token)}` : ''
                const data = await makeTranslatorRequest(`/jobs/${input.jobId}/files${params}`)
                return filesResponseSchema.parse(data)
            }),

        cancel: procedure
            .input(z.object({ jobId: z.string() }))
            .mutation(async ({ input }) => {
                await makeTranslatorRequest(`/jobs/${input.jobId}`, { method: 'DELETE' })
                return { status: 'Job canceled successfully.' }
            }),
    }),
})
