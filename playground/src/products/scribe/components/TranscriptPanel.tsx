export function TranscriptPanel({ loading, error, text, segments }: {
    loading: boolean
    error: string | undefined
    text: string | undefined
    segments?: Array<{ id: string; speaker?: string; text: string }>
}) {
    const errorMessage = loading ? undefined : error

    return (
        <div className="mb-4 rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
                <div className={`w-2 h-2 rounded-full transition-colors ${loading ? 'bg-yellow-500 animate-pulse' : errorMessage ? 'bg-red-500' : text ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-xs font-medium text-gray-500">Transcript</span>
            </div>
            <div className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap wrap-break-word bg-zoom-surface min-h-32">
                {loading
                    ? <span className="text-gray-400 animate-pulse">Waiting for response...</span>
                    : errorMessage
                        ? <span className="text-red-600">{errorMessage}</span>
                        : segments?.some(segment => segment.speaker)
                            ? <div className="flex flex-col gap-3">
                                {segments.map(segment => (
                                    <div key={segment.id} className="flex gap-3">
                                        <span className="shrink-0 font-sans font-semibold text-zoom-blue">{segment.speaker ?? 'Speaker'}</span>
                                        <span className="text-gray-800">{segment.text}</span>
                                    </div>
                                ))}
                            </div>
                        : text
                            ? <span className="text-gray-800">{text}</span>
                            : <span className="text-gray-300 select-none">Transcript will appear here...</span>
                }
            </div>
        </div>
    )
}
