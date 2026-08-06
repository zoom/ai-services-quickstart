import { useState, useRef, useEffect } from 'react'
import { AsrConfigForm } from '../components/AsrConfig'
import { JsonResult } from '../../../components/JsonResult'
import { Card, SectionHeading, Spinner } from '../../../components/ui'
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
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [fileUrl, setFileUrl] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [fileName, setFileName] = useState<string | null>(null)
    const [dragging, setDragging] = useState(false)
    const [displayText, setDisplayText] = useState<string | false>(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const [inputMode, setInputMode] = useState<InputMode>('upload')
    const [micError, setMicError] = useState<string | null>(null)
    const [recording, setRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const transcribeMutation = trpc.scribe.transcribe.useMutation({
        onSuccess: (data) => {
            setDisplayText(data.result?.text_display ?? '')
        },
    })

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
        }
    }, [])

    const handleFile = (file: File | undefined) => {
        if (!file) return
        setSelectedFile(file)
        setFileName(file.name)
        setAudioUrl(URL.createObjectURL(file))
        setRecordedBlob(null)
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
            })
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                setRecordedBlob(blob)
                setAudioUrl(URL.createObjectURL(blob))
                setFileName('recording.webm')
                stream.getTracks().forEach(t => t.stop())
                streamRef.current = null
            }

            mediaRecorder.start(250)
            setRecording(true)
            setRecordingTime(0)
            setRecordedBlob(null)
            setAudioUrl(null)
            setFileName(null)
            timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
        } catch {
            setMicError('Microphone access denied. Allow microphone permissions and try again.')
        }
    }

    const stopRecording = () => {
        mediaRecorderRef.current?.stop()
        setRecording(false)
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }

    const clearRecording = () => { setRecordedBlob(null); setAudioUrl(null); setFileName(null); setRecordingTime(0) }

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault()
        setDisplayText(false)

        if (inputMode === 'url') {
            const url = fileUrl.trim()
            if (!isValidFileUrl(url)) return
            transcribeMutation.mutate({ file: url, config })
            return
        }

        let blob: Blob | undefined
        if (inputMode === 'record') {
            if (!recordedBlob) return
            blob = recordedBlob
        } else {
            if (!selectedFile) return
            blob = selectedFile
        }

        const dataUri = await readFileAsDataUri(blob)
        transcribeMutation.mutate({ file: dataUri, config })
    }

    const canSubmit = inputMode === 'record'
        ? !!recordedBlob
        : inputMode === 'url'
            ? isValidFileUrl(fileUrl.trim())
            : !!selectedFile
    const busy = transcribeMutation.isPending
    const result = busy
        ? 'loading'
        : (transcribeMutation.data ?? (transcribeMutation.error ? { error: transcribeMutation.error.message } : null))

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
                                onClick={() => { if (recording) return; setInputMode(mode) }}
                                className={[
                                    'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-200',
                                    inputMode === mode ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                                    recording && mode !== 'record' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
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
                            fileName={fileName}
                            fileRef={fileRef}
                            audioUrl={audioUrl}
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
                                className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-900 bg-white border border-gray-200 focus:outline-none focus:border-zoom-blue/60 focus:ring-1 focus:ring-zoom-blue/30 placeholder:text-gray-400 transition-all duration-150"
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
                                recordedBlob={recordedBlob}
                                recordingTime={recordingTime}
                                audioUrl={audioUrl}
                                onStart={() => { setMicError(null); startRecording() }}
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
                <button
                    form="fast-form"
                    type="submit"
                    disabled={busy || !canSubmit}
                    className={[
                        'flex items-center gap-2 self-start px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 mb-4',
                        busy || !canSubmit
                            ? 'bg-zoom-blue/50 text-white cursor-not-allowed'
                            : 'bg-zoom-blue hover:bg-zoom-blue-hover active:scale-95 text-white shadow-lg shadow-zoom-blue/25',
                    ].join(' ')}
                >
                    {busy && <Spinner />}
                    {busy ? 'Transcribing...' : '\u25B6 Transcribe'}
                </button>
                <TranscriptPanel
                    result={result}
                    displayText={displayText}
                    segments={transcribeMutation.data?.result?.segments}
                />
                <JsonResult data={busy ? null : (transcribeMutation.data ?? null)} loading={busy} />
            </div>
        </div>
    )
}
