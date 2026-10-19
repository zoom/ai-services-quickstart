import { polishedText } from '../lib/config'
type Segment = { id: string; speaker?: string; channel?: number; language?: string; text: string }

function segmentLabel(segment: Segment, showChannel: boolean) {
    return [showChannel && `Ch ${segment.channel ?? 0}`, segment.speaker, segment.language].filter(Boolean).join(' · ')
}

export function TranscriptPanel({ loading, error, text, segments, polished, language }: {
    loading: boolean
    error: string | undefined
    text: string | undefined
    segments?: Segment[]
    polished?: string
    language?: string
}) {
    const polishing = polishedText(polished)
    const errorMessage = loading ? undefined : error
    const showChannel = !!segments?.some(s => s.channel)
    const labeled = !!segments?.some(s => s.speaker || s.language) || showChannel

    return (
        <div className="mb-4 rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
                <div className={`w-2 h-2 rounded-full transition-colors ${loading ? 'bg-yellow-500 animate-pulse' : errorMessage ? 'bg-red-500' : text ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-xs font-medium text-gray-500">Transcript</span>
                {language && !loading && <span className="ml-auto text-[11px] text-gray-400">Language: {language}</span>}
            </div>
            <div className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap wrap-break-word bg-zoom-surface min-h-32">
                {loading
                    ? <span className="text-gray-400 animate-pulse">Waiting for response...</span>
                    : errorMessage
                        ? <span className="text-red-600">{errorMessage}</span>
                        : labeled && segments
                            ? <div className="flex flex-col gap-3">
                                {segments.map(segment => (
                                    <div key={segment.id} className="flex gap-3">
                                        <span className="shrink-0 font-sans font-semibold text-zoom-blue">{segmentLabel(segment, showChannel)}</span>
                                        <span className="text-gray-800">{segment.text}</span>
                                    </div>
                                ))}
                            </div>
                        : text
                            ? <span className="text-gray-800">{text}</span>
                            : <span className="text-gray-300 select-none">Transcript will appear here...</span>
                }
            </div>
            {polished && !loading && (
                <div className="px-4 py-3 border-t border-gray-200 bg-white">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Polished text</p>
                    <p className={`text-sm leading-relaxed ${polishing.warning ? 'text-amber-600' : 'text-gray-800'}`}>{polishing.warning ? 'Polishing failed. The original transcript is shown above.' : polishing.text}</p>
                </div>
            )}
        </div>
    )
}
