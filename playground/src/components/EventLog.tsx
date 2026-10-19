export type EventRecord = { id: number; time: string; type: string | null; body: string }

// Sticky side panel listing raw WebSocket events, newest first.
export function EventLog({ title, events, empty }: { title: string; events: EventRecord[]; empty: string }) {
    return (
        <div className="lg:sticky lg:top-20">
            {/* Bound the panel to the space under the sticky offset; only the list scrolls. */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col max-h-[calc(100dvh-7rem)]">
                <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-zoom-panel">
                    <span className="text-xs font-semibold text-gray-500 tracking-wide">{title}</span>
                    {events.length > 0 && <span className="text-[11px] text-gray-400 tabular-nums">{events.length}</span>}
                </div>
                <div className="flex-1 min-h-44 overflow-y-auto p-3 bg-zoom-surface flex flex-col gap-2">
                    {events.length === 0 ? (
                        <span className="text-xs text-gray-300 select-none p-1">{empty}</span>
                    ) : (
                        events.map(ev => (
                            <div key={ev.id} className="shrink-0 rounded-lg border border-gray-200/70 bg-white overflow-hidden" style={{ animation: 'riseIn .25s ease both' }}>
                                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
                                    <span className="text-[10px] font-mono text-gray-400 tabular-nums shrink-0">{ev.time}</span>
                                    {ev.type && <span className="text-[10px] font-semibold text-zoom-blue font-mono truncate">{ev.type}</span>}
                                </div>
                                <pre className="px-3 py-2 text-[11px] leading-relaxed font-mono whitespace-pre-wrap wrap-break-word text-gray-600 max-h-40 overflow-auto">{ev.body}</pre>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
