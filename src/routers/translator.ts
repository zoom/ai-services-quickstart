import { z } from 'zod'
import { router, procedure } from '../trpc.ts'
import { createApiRequest } from '../util.ts'
import { makeBatchRouter } from './shared.ts'

const makeTranslatorRequest = createApiRequest('translator')

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
            const data = await makeTranslatorRequest('/translate', { json: input })
            return translateResponseSchema.parse(data)
        }),

    batch: makeBatchRouter(makeTranslatorRequest, translatorConfigSchema),
})
