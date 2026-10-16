import { z } from 'zod'
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
async function generateFromDataUri(dataUri: string, template: string) {
    const blob = await (await fetch(dataUri)).blob()
    const form = new FormData()
    form.append('file', blob, 'recording')
    form.append('template', template)
    return makeClinicalNotesRequest('/generate', { method: 'POST', body: form })
}

export const clinicalNotesRouter = router({
    // `file` is a data URI (upload) or an https:// / s3:// recording URL.
    generate: procedure
        .input(z.object({ file: z.string().min(1), template: templateSchema }))
        .mutation(async ({ input }) => {
            const data = input.file.startsWith('data:')
                ? await generateFromDataUri(input.file, input.template)
                : await makeClinicalNotesRequest('/generate', { json: input })
            return notesResponseSchema.parse(data)
        }),

    submitJob: procedure
        .input(z.object({ file: z.string().url(), template: templateSchema }))
        .mutation(async ({ input }) => jobResponseSchema.parse(await makeClinicalNotesRequest('/job', { json: input }))),

    getJob: procedure
        .input(z.object({ jobId: z.string() }))
        .mutation(async ({ input }) => jobResponseSchema.parse(await makeClinicalNotesRequest(`/job/${encodeURIComponent(input.jobId)}`))),
})
