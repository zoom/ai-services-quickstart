import { useState, useRef, useEffect } from 'react'
import { AsrConfigForm } from '../components/AsrConfig'
import { JsonResult } from '../../../components/JsonResult'
import { Card, SectionHeading, SubmitButton } from '../../../components/ui'
import { inputCls } from '../../../lib/constants'
import { defaultAsrConfig, type AsrConfig } from '../lib/constants'
import { readFileAsDataUri } from '../../../lib/utils'
import { AudioUploadZone } from '../components/AudioUploadZone'
import { RecordingInterface } from '../components/RecordingInterface'
import { TranscriptPanel } from '../components/TranscriptPanel'
import { trpc } from '../../../lib/trpc'

type InputMode = 'upload' | 'url' | 'record'

function isValidFileUrl(value: string) {
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

export function FastTab() {
    const [config, setConfig] = useState<AsrConfig>(defaultAsrConfig)
    const [fileUrl, setFileUrl] = useState('')
    const [uploaded, setUploaded] = useState<{ file: File; url: string } | null>(null)
    const [dragging, setDragging] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const [inputMode, setInputMode] = useState<InputMode>('upload')
    const [micError, setMicError] = useState<string | null>(null)
    const [starting, setStarting] = useState(false)
    const [recording, setRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [recorded, setRecorded] = useState<{ blob: Blob; url: string } | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const mountedRef = useRef(false)

    const transcribeMutation = trpc.scribe.transcribe.useMutation()

    // Free object URLs when they're replaced or the tab unmounts.
    useEffect(() => () => { if (uploaded) URL.revokeObjectURL(uploaded.url) }, [uploaded])
    useEffect(() => () => { if (recorded) URL.revokeObjectURL(recorded.url) }, [recorded])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            if (timerRef.current) clearInterval(timerRef.current)
            if (mediaRecorderRef.current) mediaRecorderRef.current.onstop = null
            streamRef.current?.getTracks().forEach(t => t.stop())
        }
    }, [])

    const handleFile = (file: File | undefined) => {
        if (file) setUploaded({ file, url: URL.createObjectURL(file) })
    }

    const startRecording = async () => {
        setMicError(null)
        setStarting(true)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            // Unmounted while the permission prompt was open: release the mic.
            if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
            streamRef.current = stream
            const mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t))
            const mediaRecorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop())
                streamRef.current = null
                mediaRecorderRef.current = null
                const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })
                setRecorded({ blob, url: URL.createObjectURL(blob) })
            }

            mediaRecorder.start(250)
            setRecording(true)
            setRecordingTime(0)
            setRecorded(null)
            timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
        } catch {
            streamRef.current?.getTracks().forEach(t => t.stop())
            streamRef.current = null
            setMicError('Could not start recording. Check microphone permissions and try again.')
        } finally {
            setStarting(false)
        }
    }

    const stopRecording = () => {
        mediaRecorderRef.current?.stop()
        setRecording(false)
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }

    const clearRecording = () => { setRecorded(null); setRecordingTime(0) }

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault()
        transcribeMutation.reset() // clear the previous transcript while the file is read

        if (inputMode === 'url') {
            const url = fileUrl.trim()
            if (!isValidFileUrl(url)) return
            transcribeMutation.mutate({ file: url, config })
            return
        }

        let blob: Blob | undefined
        if (inputMode === 'record') {
            if (!recorded) return
            blob = recorded.blob
        } else {
            if (!uploaded) return
            blob = uploaded.file
        }

        const dataUri = await readFileAsDataUri(blob)
        transcribeMutation.mutate({ file: dataUri, config })
    }

    const canSubmit = inputMode === 'record'
        ? !!recorded
        : inputMode === 'url'
            ? isValidFileUrl(fileUrl.trim())
            : !!uploaded
    const busy = transcribeMutation.isPending

    return (
        <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:items-start gap-5">
            <form id="fast-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Audio Source" />

                    <div className="flex rounded-lg bg-gray-100 p-0.5 mb-4">
                        {([
                            ['upload', 'Upload File', '↑'],
                            ['url', 'File URL', '🔗'],
                            ['record', 'Record Audio', '●'],
                        ] as const).map(([mode, label, icon]) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => { if (recording || starting) return; setInputMode(mode) }}
                                disabled={(recording || starting) && mode !== 'record'}
                                className={[
                                    'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-200',
                                    inputMode === mode ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                                    (recording || starting) && mode !== 'record' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                                ].join(' ')}
                            >
                                <span className={inputMode === mode && mode === 'record' ? 'text-red-500' : ''}>{icon}</span>
                                {label}
                            </button>
                        ))}
                    </div>

                    {inputMode === 'upload' && (
                        <AudioUploadZone
                            dragging={dragging}
                            setDragging={setDragging}
                            fileName={uploaded?.file.name ?? null}
                            fileRef={fileRef}
                            audioUrl={uploaded?.url ?? null}
                            onFile={handleFile}
                        />
                    )}

                    {inputMode === 'url' && (
                        <div>
                            <label htmlFor="scribe-file-url" className="block text-xs font-medium text-gray-600 mb-1.5">
                                Public audio or video file URL
                            </label>
                            <input
                                id="scribe-file-url"
                                type="url"
                                value={fileUrl}
                                onChange={e => setFileUrl(e.target.value)}
                                placeholder="https://example.com/audio.mp3"
                                className={inputCls}
                            />
                            <p className="mt-1.5 text-xs text-gray-500">
                                The URL must be publicly accessible over HTTP or HTTPS.
                            </p>
                        </div>
                    )}

                    {inputMode === 'record' && (
                        <>
                            <RecordingInterface
                                recording={recording}
                                starting={starting}
                                recordedBlob={recorded?.blob ?? null}
                                recordingTime={recordingTime}
                                audioUrl={recorded?.url ?? null}
                                onStart={startRecording}
                                onStop={stopRecording}
                                onClear={clearRecording}
                            />
                            {micError && (
                                <p className="mt-2 text-xs text-red-500">{micError}</p>
                            )}
                        </>
                    )}
                </Card>

                <Card>
                    <SectionHeading title="Transcription Config" />
                    <AsrConfigForm value={config} onChange={setConfig} />
                </Card>
            </form>

            <div className="lg:sticky lg:top-20">
                <SubmitButton form="fast-form" busy={busy} disabled={!canSubmit} label="Transcribe" busyLabel="Transcribing..." className="mb-4" />
                <TranscriptPanel
                    loading={busy}
                    error={transcribeMutation.error?.message}
                    text={transcribeMutation.data?.result?.text_display}
                    segments={transcribeMutation.data?.result?.segments}
                />
                <JsonResult data={busy ? null : (transcribeMutation.data ?? null)} loading={busy} />
            </div>
        </div>
    )
}
