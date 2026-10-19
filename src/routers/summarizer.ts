import { z } from 'zod'
import { parseApiResponse } from '../responses.ts'
import { router, procedure } from '../trpc.ts'
import { createApiRequest } from '../util.ts'
import { makeBatchRouter } from './shared.ts'

const makeSummarizerRequest = createApiRequest('summarizer')

const MAX_TEXT_BYTES = 96 * 1024

const supportedLanguages = ['en-us', 'zh-cn', 'ja-jp', 'es-es', 'fr-fr', 'de-de', 'pt-br', 'it-it', 'ar-sa', 'ar-ae'] as const
const supportedTasks = ['recap', 'action_items', 'summary', 'full_summary'] as const
const supportedSummaryTypes = ['conversation'] as const

const summarizerFastConfigSchema = z.object({
    task: z.enum(supportedTasks),
    language: z.enum(supportedLanguages).default('en-us'),
    summary_type: z.enum(supportedSummaryTypes).default('conversation'),
})

const summarizeResponseSchema = z.object({
    request_id: z.string().optional(),
    task: z.enum(supportedTasks).optional(),
    result: z.object({
        text: z.string().optional(),
        recap: z.string().optional(),
        summary_text: z.string().optional(),
        action_items: z.string().optional(),
        full_summary: z.string().optional(),
    }).optional(),
    model: z.string().optional(),
    usage: z.unknown().optional(),
})

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
            const data = await makeSummarizerRequest('/summarize', { json: input })
            return parseApiResponse(summarizeResponseSchema, data)
        }),

    batch: makeBatchRouter(makeSummarizerRequest, summarizerFastConfigSchema),
})
