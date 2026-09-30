import { useRef, useState } from 'react'
import type { BatchApiResponse, FilesResponse } from '../../lib/batchTypes'
import { isFilesResponse } from '../../lib/batchTypes'

// Returns mutation options for each batch action. Every new request bumps `seq`,
// so responses from older requests are ignored instead of overwriting the detail panel.
export function useBatchDetailState(invalidateJobs: () => void) {
    const [detail, setDetail] = useState<BatchApiResponse | null>(null)
    const [moreFilesError, setMoreFilesError] = useState<string | null>(null)
    const seq = useRef(0)

    const start = () => {
        setDetail(null)
        setMoreFilesError(null)
        return ++seq.current
    }
    const detailOptions = (refreshJobs: boolean) => ({
        onMutate: start,
        onSuccess: (data: BatchApiResponse, _vars: unknown, id: number | undefined) => {
            if (id !== seq.current) return
            setDetail(data)
            if (refreshJobs) invalidateJobs()
        },
        onError: (err: { message: string }, _vars: unknown, id: number | undefined) => {
            if (id === seq.current) setDetail({ error: err.message })
        },
    })

    return {
        detail,
        moreFilesError,
        submitOptions: detailOptions(true),
        cancelOptions: detailOptions(true),
        viewOptions: detailOptions(false),
        loadMoreOptions: {
            onMutate: () => {
                setMoreFilesError(null)
                return seq.current
            },
            onSuccess: (data: FilesResponse, _vars: unknown, id: number | undefined) => {
                if (id !== seq.current) return
                setDetail(prev => prev && isFilesResponse(prev)
                    ? { files: [...prev.files, ...data.files], next_cursor: data.next_cursor }
                    : prev)
            },
            onError: (err: { message: string }, _vars: unknown, id: number | undefined) => {
                if (id === seq.current) setMoreFilesError(err.message)
            },
        },
    }
}
