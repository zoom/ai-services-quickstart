import { z } from 'zod'

const requiredString = z.string().trim().min(1)
const nonEmptyText = z.string().refine(text => text.trim().length > 0, 'Text must not be empty.')
const questionFields = {
    name: requiredString,
    instructions: requiredString,
}

const choicesSchema = z.array(z.object({
    value: z.union([requiredString, z.boolean()]),
    description: z.string().optional(),
})).min(2, 'Choice questions require at least two choices.').superRefine((choices, ctx) => {
    const seen = new Set<string>()
    choices.forEach((choice, index) => {
        const key = choiceValueKey(choice.value)!
        if (seen.has(key)) {
            ctx.addIssue({ code: 'custom', path: [index, 'value'], message: 'Choice values must be unique, including Boolean/string equivalents.' })
        }
        seen.add(key)
    })
})

const questionSchema = z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('predicate'), ...questionFields }),
    z.strictObject({ type: z.literal('choice'), ...questionFields, choices: choicesSchema }),
    z.strictObject({
        type: z.literal('score'),
        ...questionFields,
        levels: z.array(z.object({ label: requiredString, description: z.string().optional() }))
            .min(2, 'Score questions require at least two levels.'),
    }),
])

const contentPartSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('input_text'), text: nonEmptyText }),
    z.object({ type: z.literal('input_image'), image_url: requiredString, detail: z.enum(['auto', 'low', 'high', 'original']).optional() }),
])

export const decisionsInputSchema = z.object({
    input: z.union([
        nonEmptyText,
        z.array(z.object({ role: z.literal('user'), content: z.array(contentPartSchema).min(1) })).min(1),
    ]),
    questions: z.array(questionSchema).min(1).superRefine((questions, ctx) => {
        const seen = new Set<string>()
        questions.forEach((question, index) => {
            if (seen.has(question.name)) {
                ctx.addIssue({ code: 'custom', path: [index, 'name'], message: 'Question names must be unique.' })
            }
            seen.add(question.name)
        })
    }),
    model: z.enum(['zoom-decisions-standard', 'zoom-decisions-pro']).optional(),
    enable_image_input: z.boolean().optional(),
}).superRefine((request, ctx) => {
    if (Array.isArray(request.input) && request.enable_image_input !== true) {
        request.input.forEach((message, messageIndex) => {
            message.content.forEach((part, partIndex) => {
                if (part.type === 'input_image') {
                    ctx.addIssue({ code: 'custom', path: ['input', messageIndex, 'content', partIndex], message: 'Image input requires enable_image_input: true.' })
                }
            })
        })
    }
})

export function choiceValueKey(value: unknown): string | undefined {
    return typeof value === 'string' || typeof value === 'boolean' ? String(value) : undefined
}
