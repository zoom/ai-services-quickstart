import { z } from 'zod'

export const ttsVoices = ['alex', 'ariel', 'ava', 'brooke', 'hazel', 'jenna', 'mark', 'reid', 'scott', 'tony'] as const
export const TTS_MAX_CHARACTERS = 4000
export const TTS_MAX_BYTES = 32768

export const ttsInputSchema = z.strictObject({
    input: z.string().refine(text => text.trim().length > 0, 'Enter text to synthesize.')
        .refine(text => Array.from(text).length <= TTS_MAX_CHARACTERS, 'Text exceeds 4,000 Unicode code points.'),
    voice: z.string().toLowerCase().pipe(z.enum(ttsVoices)).optional(),
    speed: z.number().min(0.5).max(2).optional(),
    volume: z.number().gt(0).max(10).optional(),
    response_format: z.literal('pcm_44100').optional(),
})
