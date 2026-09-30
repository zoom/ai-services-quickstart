import { MarkdownContent } from '../../../components/MarkdownContent'

// Written out because the server schema's .catchall() erases these fields from the inferred type.
type SummarizerResponse = {
    task?: string
    model?: string
    result?: { text?: string; recap?: string; summary_text?: string; action_items?: string }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{title}</h3>
            {children}
        </div>
    )
}

export function SummarizerResult({ data, error, loading }: {
    data: SummarizerResponse | undefined
    error: string | undefined
    loading: boolean
}) {
    const payload = data?.result
    const hasContent = Boolean(payload?.text || payload?.recap || payload?.summary_text || payload?.action_items)

    return (
        <div className="mb-4 rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
                <div className={`w-2 h-2 rounded-full transition-colors ${loading ? 'bg-yellow-500 animate-pulse' : hasContent ? 'bg-emerald-500' : error ? 'bg-red-500' : 'bg-gray-300'}`} />
                <span className="text-xs font-medium text-gray-500">Summary</span>
            </div>

            <div className="p-4 bg-zoom-surface min-h-48 flex flex-col gap-3">
                {loading && (
                    <span className="text-xs text-gray-400 animate-pulse">Waiting for response...</span>
                )}

                {!loading && error && (
                    <Section title="Error">
                        <p className="text-xs font-mono text-red-600 whitespace-pre-wrap">{error}</p>
                    </Section>
                )}

                {!loading && !error && hasContent && (
                    <>
                        {payload?.text && (
                            <Section title="Text Result">
                                <MarkdownContent>{payload.text}</MarkdownContent>
                            </Section>
                        )}

                        {payload?.recap && (
                            <Section title="Recap">
                                <MarkdownContent>{payload.recap}</MarkdownContent>
                            </Section>
                        )}

                        {payload?.summary_text && (
                            <Section title="Detailed Summary">
                                <MarkdownContent>{payload.summary_text}</MarkdownContent>
                            </Section>
                        )}

                        {payload?.action_items && (
                            <Section title="Action Items">
                                <MarkdownContent>{payload.action_items}</MarkdownContent>
                            </Section>
                        )}

                        {(data?.task || data?.model) && (
                            <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                                {data?.task && <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200">Task: {data.task}</span>}
                                {data?.model && <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200">Model: {data.model}</span>}
                            </div>
                        )}
                    </>
                )}

                {!loading && !error && !hasContent && (
                    <span className="text-xs text-gray-300 select-none">Summary output will appear here...</span>
                )}
            </div>
        </div>
    )
}
