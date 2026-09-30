import { useState } from 'react'
import { colorizeJson } from '../lib/colorizeJson'

const toggleCls = (active: boolean) =>
    `px-2 py-0.5 text-[11px] rounded-md transition-all ${active ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`

// Response panel: colorized JSON, plus an optional "Visual" view and footer (used by batch jobs).
export function JsonResult({ data, loading, visual, footer, className = 'h-full' }: {
    data: unknown
    loading?: boolean
    visual?: React.ReactNode
    footer?: React.ReactNode
    className?: string
}) {
    const [showVisual, setShowVisual] = useState(false)
    const isEmpty = data === null && !loading
    const isError = !!data && typeof data === 'object' && (data as { error?: unknown }).error != null
    const ready = !loading && !isEmpty
    const visualShown = ready && showVisual && visual !== undefined

    const json = isEmpty ? '' : JSON.stringify(data, null, 2)
    const colorized = colorizeJson(json)

    return (
        <div className={`rounded-xl border overflow-hidden transition-all duration-300 flex flex-col ${className} ${isError ? 'border-red-300' : 'border-gray-200'}`}>
            <div className={`flex items-center justify-between px-4 py-2.5 border-b shrink-0 ${isError ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-colors ${loading ? 'bg-yellow-500 animate-pulse' : isEmpty ? 'bg-gray-300' : isError ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <span className="text-xs font-medium text-gray-500">Response</span>
                </div>
                <div className="flex items-center gap-2">
                    {ready && visual !== undefined && (
                        <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-gray-100 border border-gray-200">
                            <button type="button" onClick={() => setShowVisual(false)} className={toggleCls(!showVisual)}>JSON</button>
                            <button type="button" onClick={() => setShowVisual(true)} className={toggleCls(showVisual)}>Visual</button>
                        </div>
                    )}
                    {ready && !visualShown && (
                        <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(json)}
                            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            Copy
                        </button>
                    )}
                </div>
            </div>
            {visualShown ? (
                <div className="p-4 bg-zoom-surface flex-1 overflow-y-auto">{visual}</div>
            ) : (
                <pre className="p-4 text-xs font-mono overflow-y-scroll flex-1 whitespace-pre-wrap wrap-break-word leading-relaxed bg-zoom-surface min-h-48 max-h-[calc(100vh-12rem)]">
                    {loading
                        ? <span className="text-gray-400 animate-pulse">Waiting for response…</span>
                        : isEmpty
                            ? <span className="text-gray-300 select-none">Response will appear here…</span>
                            : colorized
                    }
                </pre>
            )}
            {footer}
        </div>
    )
}
