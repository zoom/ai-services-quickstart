import { z } from 'zod'
import { router, procedure } from '../trpc.ts'
import { createApiRequest } from '../util.ts'

const makeDecisionsRequest = createApiRequest('decisions')

const questionSchema = z.object({
    type: z.enum(['predicate', 'choice', 'score']),
    name: z.string().optional(),
    instructions: z.string().min(1),
    choices: z.array(z.object({ value: z.union([z.string(), z.boolean()]), description: z.string().optional() })).optional(),
    levels: z.array(z.object({ label: z.string(), description: z.string().optional() })).optional(),
})

const contentPartSchema = z.union([
    z.object({ type: z.literal('input_text'), text: z.string() }),
    z.object({ type: z.literal('input_image'), image_url: z.string(), detail: z.enum(['auto', 'low', 'high', 'original']).optional() }),
])

export const decisionsRouter = router({
    decide: procedure
        .input(z.object({
            input: z.union([z.string().min(1), z.array(z.object({ role: z.literal('user'), content: z.array(contentPartSchema) }))]),
            questions: z.array(questionSchema).min(1),
            model: z.enum(['zoom-decisions-standard', 'zoom-decisions-pro']).optional(),
            enable_image_input: z.boolean().optional(),
        }))
        // The answer shape depends on each question's type, so the response is returned as-is.
        .mutation(async ({ input }) => (await makeDecisionsRequest('/decide', { json: input })) as Record<string, unknown>),
})
