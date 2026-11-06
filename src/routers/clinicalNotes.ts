import { z } from 'zod'
import { parseApiResponse } from '../responses.ts'
import { router, procedure } from '../trpc.ts'
import { createApiRequest } from '../util.ts'

const makeClinicalNotesRequest = createApiRequest('clinical_notes')

const templateSchema = z.enum(['SOAP', 'GENERAL_MEDICINE', 'GENERAL_BEHAVIORAL_HEALTH'])

const notesResponseSchema = z.object({
    request_id: z.string().optional(),
    transcript: z.object({ text_display: z.string().optional() }).optional(),
    clinical_notes: z.object({
        full_note: z.string().optional(),
        sections: z.array(z.object({ title: z.string(), content: z.string() })).optional(),
    }).optional(),
})

const jobResponseSchema = notesResponseSchema.extend({
    job_id: z.string(),
    state: z.string(),
    submitted_at: z.string().optional(),
    completed_at: z.string().optional(),
    error: z.unknown().optional(),
})

// The API takes an upload as multipart and a recording URL as JSON; it doesn't accept data URLs.
async function generateFromDataUri(dataUri: string, template: string, fileName = 'recording') {
    const blob = await (await fetch(dataUri)).blob()
    const form = new FormData()
    form.append('file', blob, fileName)
    form.append('template', template)
    return makeClinicalNotesRequest('/generate', { method: 'POST', body: form })
}

export const clinicalNotesRouter = router({
    // `file` is a data URI (upload) or an https:// / s3:// recording URL.
    generate: procedure
        .input(z.object({ file: z.string().min(1), template: templateSchema, fileName: z.string().optional() }))
        .mutation(async ({ input }) => {
            const data = input.file.startsWith('data:')
                ? await generateFromDataUri(input.file, input.template, input.fileName)
                : await makeClinicalNotesRequest('/generate', { json: { file: input.file, template: input.template } })
            return parseApiResponse(notesResponseSchema, data)
        }),

    submitJob: procedure
        .input(z.object({ file: z.string().url(), template: templateSchema }))
        .mutation(async ({ input }) => parseApiResponse(jobResponseSchema, await makeClinicalNotesRequest('/job', { json: { file: input.file, template: input.template } }))),

    getJob: procedure
        .input(z.object({ jobId: z.string() }))
        .mutation(async ({ input }) => parseApiResponse(jobResponseSchema, await makeClinicalNotesRequest(`/job/${encodeURIComponent(input.jobId)}`))),
})
