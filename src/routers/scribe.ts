import { z } from 'zod'
import { router, procedure } from '../trpc.ts'
import { createApiRequest } from '../util.ts'
import { makeBatchRouter } from './shared.ts'

const makeScribeRequest = createApiRequest('scribe')
const scribeConfigSchema = z.object({
    language: z.string(),
    channel_separation: z.boolean(),
    diarization: z.boolean(),
}).refine(config => !(config.channel_separation && config.diarization), {
    message: 'Channel separation and diarization cannot both be enabled.',
    path: ['diarization'],
})

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
            config: scribeConfigSchema,
        }))
        .mutation(async ({ input }) => {
            const data = await makeScribeRequest('/transcribe', { json: input })
            return transcribeResponseSchema.parse(data)
        }),

    batch: makeBatchRouter(makeScribeRequest, scribeConfigSchema.optional(), { language: 'en-US' }),
})
