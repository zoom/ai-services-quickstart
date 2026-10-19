import { useState } from 'react'
import { KV } from './KV'
import {
    type BatchApiResponse,
    type CancelResponse,
    isErrorResponse,
    isFilesResponse,
    isFileResponse,
    isJobResponse,
} from '../../lib/batchTypes'
import { StateBadge } from './StateBadge'

function ApiError({ error }: { error: string | { code?: string; message?: string } }) {
    const message = typeof error === 'string' ? error : (error.message ?? JSON.stringify(error))
    return <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 break-words">{typeof error === 'object' && error.code && <strong>{error.code}: </strong>}{message}</div>
}

function OutputUri({ uri }: { uri?: string | null }) {
    const [copyStatus, setCopyStatus] = useState('')
    if (!uri) return <span className="text-gray-400">Not available yet</span>
    return <div className="flex flex-col gap-1 min-w-40">
        <input aria-label="Output URI" className="font-mono text-[10px] w-full bg-transparent text-gray-600" value={uri} readOnly onFocus={e => e.currentTarget.select()} title={uri} />
        <button type="button" className="text-left text-[10px] text-zoom-blue" onClick={async () => {
            try { await navigator.clipboard.writeText(uri); setCopyStatus('Copied') }
            catch { setCopyStatus('Select the URI above to copy') }
        }}>{copyStatus || 'Copy URI'}</button>
    </div>
}

export function BatchResultVisual({ data, onFileDetail }: { data: BatchApiResponse; onFileDetail?: (fileId: string) => void }) {
    if (isErrorResponse(data) && !isJobResponse(data) && !isFileResponse(data)) return <ApiError error={data.error} />

    if (isFilesResponse(data) || isFileResponse(data)) {
        const singleFile = isFileResponse(data)
        const files = singleFile ? [data] : data.files
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">{singleFile ? 'File details' : 'Files'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{files.length}</span>
                </div>
                {files.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">No files yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    {['File', 'State', 'Duration', 'Output'].map(h => (
                                        <th key={h} className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {files.map(f => {
                                    const filename = f.input_uri.split('/').pop() ?? f.input_uri
                                    const errMsg = f.error
                                        ? typeof f.error === 'string' ? f.error : f.error.message
                                        : null
                                    return (
                                        <tr key={f.file_id} className="hover:bg-gray-50 align-top">
                                            <td className="py-2 px-2 max-w-[200px]">
                                                <span className="font-mono text-gray-700 block truncate" title={f.input_uri}>{filename}</span>
                                                {singleFile && <span className="block text-[10px] text-gray-500 break-all">{f.file_id}</span>}
                                                {!singleFile && onFileDetail && <button type="button" onClick={() => onFileDetail(f.file_id)} className="block text-[10px] text-zoom-blue mt-1">View details</button>}
                                                {errMsg && <p className="text-[10px] text-red-500 mt-0.5 leading-snug truncate" title={errMsg}>{errMsg}</p>}
                                            </td>
                                            <td className="py-2 px-2 whitespace-nowrap"><StateBadge state={f.state} /></td>
                                            <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{f.duration_sec != null ? `${f.duration_sec}s` : '—'}</td>
                                            <td className="py-2 px-2"><OutputUri uri={f.output_uri} /></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )
    }

    if (isJobResponse(data)) {
        const { job_id, state, reference_id, submitted_at, completed_at, input, output, stats, summary, config, status } = data
        return (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    {job_id && <KV label="Job ID" value={job_id} mono />}
                    {state && <KV label="State" value={<StateBadge state={state} />} />}
                    {reference_id && <KV label="Reference ID" value={reference_id} mono />}
                    {submitted_at && <KV label="Submitted" value={new Date(submitted_at).toLocaleString()} />}
                    {completed_at && <KV label="Completed" value={new Date(completed_at).toLocaleString()} />}
                </div>
                {data.error && <ApiError error={data.error} />}
                {input && (
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex flex-col gap-2">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Input</p>
                        <div className="grid grid-cols-2 gap-2">
                            <KV label="Mode" value={input.mode} />
                            {input.source && <KV label="Source" value={input.source} />}
                        </div>
                        {input.uri && <KV label="URI" value={input.uri} mono />}
                    </div>
                )}
                {output && (
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex flex-col gap-2">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Output</p>
                        <div className="grid grid-cols-2 gap-2">
                            <KV label="Destination" value={output.destination} />
                            <KV label="Layout" value={output.layout} />
                        </div>
                        {output.uri && <KV label="URI" value={output.uri} mono />}
                    </div>
                )}
                {(stats ?? summary) && (
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Stats</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.entries(stats ?? summary ?? {}) as [string, number | undefined][]).map(([k, v]) => (
                                <div key={k} className="text-center">
                                    <p className="text-base font-bold text-gray-700">{v ?? '—'}</p>
                                    <p className="text-[10px] text-gray-500 capitalize">{k.replace(/_/g, ' ')}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {config && (
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Config</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(config) as [string, unknown][])
                                .filter(([, v]) => v !== null && typeof v !== 'object')
                                .map(([k, v]) => (
                                    <KV key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                                ))}
                        </div>
                    </div>
                )}
                {status && <KV label="Status" value={status} />}
            </div>
        )
    }

    return <KV label="Status" value={(data as CancelResponse).status} />
}
