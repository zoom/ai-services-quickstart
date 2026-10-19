import { z } from 'zod'
import { parseApiResponse } from '../responses.ts'
import { router, procedure } from '../trpc.ts'
import { createApiRequest } from '../util.ts'
import { makeBatchRouter } from './shared.ts'
import { translatorLanguages } from '../config/translatorLanguages.ts'

const makeTranslatorRequest = createApiRequest('translator')

const languageCode = z.string().transform(value =>
    translatorLanguages.find(locale => locale.value.toLowerCase() === value.toLowerCase())?.value ?? value,
).pipe(z.enum(translatorLanguages.map(locale => locale.value)))
export const translatorConfigSchema = z.object({
    source_language: languageCode.optional(),
    target_languages: z.array(languageCode).min(1).max(1),
})

const translateResponseSchema = z.object({
    request_id: z.string().optional(),
    result: z.object({
        translations: z.record(z.string(), z.string()).optional(),
    }).optional(),
    model: z.string().optional(),
    usage: z.unknown().optional(),
})

export const translatorRouter = router({
    translate: procedure
        .input(z.object({
            text: z.string().min(1).max(4000),
            config: translatorConfigSchema,
        }))
        .mutation(async ({ input }) => {
            const data = await makeTranslatorRequest('/translate', { json: input })
            return parseApiResponse(translateResponseSchema, data)
        }),

    batch: makeBatchRouter(makeTranslatorRequest, translatorConfigSchema),
})
