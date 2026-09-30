export function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
            <span className={`text-xs text-gray-700 break-words ${mono ? 'font-mono break-all' : ''}`}>{value}</span>
        </div>
    )
}
