import { z } from 'zod'
import { parseApiResponse } from '../responses.ts'
import { router, procedure } from '../trpc.ts'
import { createApiRequest } from '../util.ts'
import { makeBatchRouter } from './shared.ts'

const makeScribeRequest = createApiRequest('scribe')

export const scribeConfigSchema = z.object({
    language: z.string().trim().min(1).optional(),
    channel_separation: z.boolean(),
    diarization: z.boolean(),
    // Omit for automatic model selection. zoom-scribe-en-pro is Scribe API 3B Pro High-Accuracy.
    model: z.string().optional(),
    language_detection: z.object({
        mode: z.enum(['once', 'continuous']),
        candidate_languages: z.array(z.string().trim().min(1)).min(1).optional(),
    }).optional(),
    word_time_offsets: z.boolean().optional(),
    segmentation_mode: z.enum(['auto', 'none']).optional(),
    profanity_filter: z.boolean().optional(),
    vocabulary: z.object({ phrases: z.array(z.string()).max(100) }).optional(),
    vocabulary_id: z.string().optional(),
    // Not a Scribe config field: the server sends it as outputs.text_polishing (en-US only).
    text_polishing: z.boolean().optional(),
}).superRefine((config, ctx) => {
    const detection = config.language_detection
    if (detection?.mode === 'once' && config.model) ctx.addIssue({ code: 'custom', path: ['model'], message: 'Omit the model for once-only language detection.' })
    if (detection?.mode === 'continuous' && config.model && !['zoom-scribe-multilingual', 'whisper'].includes(config.model)) ctx.addIssue({ code: 'custom', path: ['model'], message: 'Continuous detection requires a multilingual model or automatic selection.' })
    if (config.language && detection?.candidate_languages && !detection.candidate_languages.some(language => language.toLowerCase() === config.language!.toLowerCase())) ctx.addIssue({ code: 'custom', path: ['language_detection', 'candidate_languages'], message: 'Include the preferred language in candidate languages.' })
    if (config.text_polishing && detection) ctx.addIssue({ code: 'custom', path: ['text_polishing'], message: 'Text polishing cannot be combined with language detection.' })
    if (config.text_polishing && (config.language ?? 'en-US').toLowerCase() !== 'en-us') ctx.addIssue({ code: 'custom', path: ['text_polishing'], message: 'Text polishing requires en-US.' })
    if (config.vocabulary && config.vocabulary_id) ctx.addIssue({ code: 'custom', path: ['vocabulary_id'], message: 'Choose inline vocabulary or a Vocabulary Asset ID.' })
    if (config.model?.startsWith('zoom-scribe-en') && config.language && config.language.toLowerCase() !== 'en-us') ctx.addIssue({ code: 'custom', path: ['model'], message: 'The English model requires en-US.' })
})

type ScribeConfig = z.infer<typeof scribeConfigSchema>

// Split the playground config into the API's `config` and `outputs` fields.
function toScribeBody({ text_polishing, vocabulary, ...config }: ScribeConfig) {
    const phrases = vocabulary?.phrases.map(p => p.trim()).filter(Boolean)
    return {
        config: { ...config, ...(phrases?.length && { vocabulary: { phrases } }) },
        ...(text_polishing && { outputs: { text_polishing: { enabled: true } } }),
    }
}

const transcribeResponseSchema = z.object({
    request_id: z.string().optional(),
    duration_sec: z.number().optional(),
    result: z.object({
        text_display: z.string().optional(),
        text_lexical: z.string().optional(),
        language: z.string().optional(),
        segments: z.array(z.object({
            id: z.string(),
            start: z.number(),
            end: z.number(),
            channel: z.number().optional(),
            speaker: z.string().optional(),
            language: z.string().optional(),
            text: z.string(),
            words: z.array(z.object({
                word: z.string(),
                start: z.number(),
                end: z.number(),
            })).optional(),
        })).optional(),
    }).optional(),
    outputs: z.object({ text_polishing: z.object({ text: z.string() }).optional() }).optional(),
    model: z.string().optional(),
    metrics: z.unknown().optional(),
    usage: z.unknown().optional(),
})

export const scribeRouter = router({
    transcribe: procedure
        .input(z.object({
            file: z.string(),
            config: scribeConfigSchema,
        }))
        .mutation(async ({ input }) => {
            const data = await makeScribeRequest('/transcribe', { json: { file: input.file, ...toScribeBody(input.config) } })
            return parseApiResponse(transcribeResponseSchema, data)
        }),

    batch: makeBatchRouter(makeScribeRequest, scribeConfigSchema.optional(), { language: 'en-US', channel_separation: false, diarization: false },
        config => (config ? toScribeBody(config) : {}), { singleOutput: true }),
})
