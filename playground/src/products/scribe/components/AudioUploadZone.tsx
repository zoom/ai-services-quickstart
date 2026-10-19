import { useState, type RefObject } from 'react'
import { scribeUploadPolicy, validateUpload, type UploadPolicy } from '../../../../../src/config/uploads'

interface Props {
    required?: boolean
    policy?: UploadPolicy
    dragging: boolean
    setDragging: (v: boolean) => void
    fileName: string | null
    fileRef: RefObject<HTMLInputElement | null>
    audioUrl: string | null
    onFile: (file: File | undefined) => void
}

export function AudioUploadZone({ dragging, setDragging, fileName, fileRef, audioUrl, onFile, required = true, policy = scribeUploadPolicy }: Props) {
    const [error, setError] = useState<string | null>(null)
    const selectFile = (file: File | undefined) => {
        const message = file ? validateUpload(file, policy) : null
        setError(message)
        if (message || !file) {
            if (fileRef.current) fileRef.current.value = ''
            onFile(undefined)
            return
        }
        if (fileRef.current) {
            const dt = new DataTransfer()
            dt.items.add(file)
            fileRef.current.files = dt.files
        }
        onFile(file)
    }
    return (
        <>
            <div
                className={[
                    'relative rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer',
                    dragging ? 'border-zoom-blue bg-zoom-blue/5' : 'border-gray-300 hover:border-gray-400 bg-gray-50',
                ].join(' ')}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                    e.preventDefault()
                    setDragging(false)
                    const file = e.dataTransfer.files[0]
                    selectFile(file)
                }}
                onClick={() => fileRef.current?.click()}
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept={policy.extensions.map(extension => `.${extension}`).join(',')}
                    required={required}
                    className="sr-only"
                    onChange={e => selectFile(e.target.files?.[0])}
                />
                <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                    {fileName ? (
                        <>
                            <div className="w-10 h-10 rounded-full bg-zoom-blue/10 flex items-center justify-center text-zoom-blue">&#9835;</div>
                            <span className="text-sm font-medium text-gray-700">{fileName}</span>
                            <span className="text-xs text-gray-500">Click to change file</span>
                        </>
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">&uarr;</div>
                            <span className="text-sm text-gray-500">Drop audio file here or <span className="text-zoom-blue font-medium">browse</span></span>
                            <span className="text-xs text-gray-500">{policy.hint}</span>
                        </>
                    )}
                </div>
            </div>

            {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
            {audioUrl && (
                <audio src={audioUrl} controls className="mt-3 w-full rounded-lg h-10" />
            )}
        </>
    )
}
