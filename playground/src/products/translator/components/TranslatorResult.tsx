import type { RouterOutputs } from '../../../lib/trpc'

export function TranslatorResult({ data, error, loading }: {
    data: RouterOutputs['translator']['translate'] | undefined
    error: string | undefined
    loading: boolean
}) {
    const errorMessage = loading ? null : error
    const translations = Object.entries(data?.result?.translations ?? {})
    const hasResult = !loading && translations.length > 0

    return (
        <div className="mb-4 rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
                <div className={`w-2 h-2 rounded-full transition-colors ${loading ? 'bg-yellow-500 animate-pulse' : errorMessage ? 'bg-red-500' : hasResult ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-xs font-medium text-gray-500">Translation</span>
                {data?.model && (
                    <span className="ml-auto text-[10px] text-gray-400 font-mono">
                        model: <span className="text-gray-600 font-semibold">{data.model}</span>
                    </span>
                )}
            </div>
            <div className="bg-zoom-surface min-h-32">
                {loading ? (
                    <p className="p-4 text-xs text-gray-400 animate-pulse font-mono">Waiting for response...</p>
                ) : errorMessage ? (
                    <p className="p-4 text-xs font-mono text-red-600 whitespace-pre-wrap">{errorMessage}</p>
                ) : !hasResult ? (
                    <p className="p-4 text-xs text-gray-300 select-none font-mono">Translation will appear here...</p>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {translations.map(([language, text]) => (
                            <div key={language} className="p-4">
                                <span className="inline-flex items-center gap-1 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                                    <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-gray-600">{language}</span>
                                </span>
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
