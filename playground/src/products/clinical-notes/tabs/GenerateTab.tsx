import { useState } from 'react'
import { Card, ErrorNote, Field, SectionHeading, SubmitButton } from '../../../components/ui'
import { JsonResult } from '../../../components/JsonResult'
import { inputCls } from '../../../lib/constants'
import { readFileAsDataUri } from '../../../lib/utils'
import { trpc } from '../../../lib/trpc'
import { AudioUploadZone } from '../../scribe/components/AudioUploadZone'
import { clinicalUploadPolicy } from '../../../../../src/config/uploads'
import { useAudioUpload } from '../../../lib/useAudioUpload'
import { NoteResult, TemplateSelect, type Template } from '../lib'

export function GenerateTab() {
    const upload = useAudioUpload()
    const [mode, setMode] = useState<'upload' | 'url'>('upload')
    const [fileUrl, setFileUrl] = useState('')
    const [template, setTemplate] = useState<Template>('GENERAL_MEDICINE')
    const generate = trpc.clinicalNotes.generate.useMutation()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        // Send only the selected input mode; the server forwards uploads as multipart.
        const file = mode === 'url' ? fileUrl.trim() : (upload.file && await readFileAsDataUri(upload.file))
        if (file) generate.mutate({ file, template, ...(mode === 'upload' && upload.file ? { fileName: upload.file.name } : {}) })
    }

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="clinical-notes-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Recording" />
                    <div className="flex gap-3 mb-4">
                        {(['upload', 'url'] as const).map(option => <button type="button" key={option} aria-pressed={mode === option} onClick={() => setMode(option)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">{option === 'upload' ? 'Upload recording' : 'Recording URL'}</button>)}
                    </div>
                    {mode === 'upload' ? <AudioUploadZone {...upload.zoneProps} policy={clinicalUploadPolicy} /> : <div>
                        <Field label="Recording URL" hint="Downloadable https:// or s3:// URI">
                            <input required className={inputCls} value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://example.com/consultation.wav" />
                        </Field>
                    </div>}
                </Card>
                <Card>
                    <TemplateSelect value={template} onChange={setTemplate} />
                </Card>
            </form>

            <div className="lg:sticky lg:top-20 flex flex-col gap-4">
                <SubmitButton form="clinical-notes-form" busy={generate.isPending} disabled={mode === 'upload' ? !upload.file : !fileUrl.trim()} label="Generate note" busyLabel="Generating..." />
                <p className="text-xs text-gray-500">Clinical Notes availability depends on your account and deployment. A 404 can mean the route or access is unavailable.</p>
                {generate.error && <ErrorNote>{generate.error.message}</ErrorNote>}
                <NoteResult data={generate.data} />
                <JsonResult data={generate.data ?? null} loading={generate.isPending} />
            </div>
        </div>
    )
}
