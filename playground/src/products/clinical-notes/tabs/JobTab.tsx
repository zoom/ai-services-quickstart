import { useState } from 'react'
import { Card, ErrorNote, Field, SectionHeading, SubmitButton } from '../../../components/ui'
import { JsonResult } from '../../../components/JsonResult'
import { inputCls } from '../../../lib/constants'
import { trpc } from '../../../lib/trpc'
import { NoteResult, TemplateSelect, type Template } from '../lib'

export function JobTab() {
    const [fileUrl, setFileUrl] = useState('')
    const [template, setTemplate] = useState<Template>('GENERAL_MEDICINE')
    const submit = trpc.clinicalNotes.submitJob.useMutation()
    const status = trpc.clinicalNotes.getJob.useMutation()
    const job = status.data ?? submit.data
    const error = (status.error ?? submit.error)?.message

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="clinical-notes-job-form" onSubmit={e => { e.preventDefault(); status.reset(); submit.mutate({ file: fileUrl.trim(), template }) }} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Submit a job" />
                    <div className="flex flex-col gap-4">
                        <Field label="Recording URL" hint="Must stay downloadable until the job finishes">
                            <input required className={inputCls} value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://example.com/consultation.wav" />
                        </Field>
                        <TemplateSelect value={template} onChange={setTemplate} />
                    </div>
                </Card>
            </form>

            <div className="lg:sticky lg:top-20 flex flex-col gap-4">
                <div className="flex gap-3">
                    <SubmitButton form="clinical-notes-job-form" busy={submit.isPending} disabled={!fileUrl.trim()} label="Submit job" busyLabel="Submitting..." />
                    {job && (
                        <button type="button" onClick={() => status.mutate({ jobId: job.job_id })} disabled={status.isPending}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50">
                            {status.isPending ? 'Checking…' : `Check status (${job.state})`}
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-500">Clinical Notes availability depends on your account and deployment. A 404 can mean the route or access is unavailable.</p>
                {error && <ErrorNote>{error}</ErrorNote>}
                {job?.state === 'SUCCEEDED' && <NoteResult data={job} />}
                <JsonResult data={job ?? null} loading={submit.isPending || status.isPending} />
            </div>
        </div>
    )
}
