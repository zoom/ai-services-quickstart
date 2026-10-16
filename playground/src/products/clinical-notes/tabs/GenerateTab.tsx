import { useState } from 'react'
import { Card, ErrorNote, Field, SectionHeading, SubmitButton } from '../../../components/ui'
import { JsonResult } from '../../../components/JsonResult'
import { inputCls } from '../../../lib/constants'
import { readFileAsDataUri } from '../../../lib/utils'
import { trpc } from '../../../lib/trpc'
import { AudioUploadZone } from '../../scribe/components/AudioUploadZone'
import { useAudioUpload } from '../../../lib/useAudioUpload'
import { NoteResult, TemplateSelect, type Template } from '../lib'

export function GenerateTab() {
    const upload = useAudioUpload()
    const [fileUrl, setFileUrl] = useState('')
    const [template, setTemplate] = useState<Template>('GENERAL_MEDICINE')
    const generate = trpc.clinicalNotes.generate.useMutation()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        // A URL takes precedence; otherwise the upload is sent as a data URI and forwarded as multipart.
        const file = fileUrl.trim() || (upload.file && await readFileAsDataUri(upload.file))
        if (file) generate.mutate({ file, template })
    }

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="clinical-notes-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Recording" />
                    <AudioUploadZone {...upload.zoneProps} />
                    <div className="mt-4">
                        <Field label="Or recording URL" hint="Downloadable https:// or s3:// URI">
                            <input className={inputCls} value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://example.com/consultation.wav" />
                        </Field>
                    </div>
                </Card>
                <Card>
                    <TemplateSelect value={template} onChange={setTemplate} />
                </Card>
            </form>

            <div className="lg:sticky lg:top-20 flex flex-col gap-4">
                <SubmitButton form="clinical-notes-form" busy={generate.isPending} disabled={!upload.file && !fileUrl.trim()} label="Generate note" busyLabel="Generating..." />
                {generate.error && <ErrorNote>{generate.error.message}</ErrorNote>}
                <NoteResult data={generate.data} />
                <JsonResult data={generate.data ?? null} loading={generate.isPending} />
            </div>
        </div>
    )
}
