import { useEffect, useRef, useState } from 'react'

// State for <AudioUploadZone>: the picked file, its preview URL (revoked when replaced), and drag state.
export function useAudioUpload() {
    const [uploaded, setUploaded] = useState<{ file: File; url: string } | null>(null)
    const [dragging, setDragging] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => () => { if (uploaded) URL.revokeObjectURL(uploaded.url) }, [uploaded])

    return {
        file: uploaded?.file ?? null,
        zoneProps: {
            dragging,
            setDragging,
            fileRef,
            fileName: uploaded?.file.name ?? null,
            audioUrl: uploaded?.url ?? null,
            onFile: (file: File | undefined) => { if (file) setUploaded({ file, url: URL.createObjectURL(file) }) },
        },
    }
}
