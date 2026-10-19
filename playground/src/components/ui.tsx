import { useState } from 'react'

export function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
    )
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={[
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none',
                checked ? 'bg-zoom-blue' : 'bg-gray-300',
            ].join(' ')}
        >
            <span className={[
                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                checked ? 'translate-x-4.5' : 'translate-x-0.5',
            ].join(' ')} />
        </button>
    )
}

// Labeled on/off switch with a one-line hint.
export function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
            <span>
                <span className="block text-sm font-medium text-gray-700">{label}</span>
                {hint && <span className="block text-xs text-gray-500 leading-snug">{hint}</span>}
            </span>
            <Toggle checked={checked} onChange={onChange} />
        </label>
    )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
    return <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg py-2 px-3 whitespace-pre-wrap">{children}</p>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{label}</label>
            <p className="text-xs text-gray-500 leading-relaxed min-h-4">{hint}</p>
            {children}
        </div>
    )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-xl border border-gray-200 bg-white p-5 ${className}`}>
            {children}
        </div>
    )
}

export function CollapsibleCard({
    title, children, defaultOpen = true,
}: {
    title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
                <h2 className="text-sm font-semibold text-gray-700 tracking-wide">{title}</h2>
                <span className={`text-gray-500 text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {open && <div className="px-5 pb-5">{children}</div>}
        </div>
    )
}

export function SectionHeading({ title }: { title: string }) {
    return (
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide mb-4">{title}</h2>
    )
}

export function SubmitButton({ form, busy, disabled, label, busyLabel, className = '' }: {
    form: string
    busy: boolean
    disabled?: boolean
    label: string
    busyLabel: string
    className?: string
}) {
    const off = busy || disabled
    return (
        <button
            form={form}
            type="submit"
            disabled={off}
            className={[
                'flex items-center gap-2 self-start px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
                className,
                off
                    ? 'bg-zoom-blue/50 text-white cursor-not-allowed'
                    : 'bg-zoom-blue hover:bg-zoom-blue-hover active:scale-95 text-white shadow-lg shadow-zoom-blue/25',
            ].join(' ')}
        >
            {busy && <Spinner />}
            {busy ? busyLabel : `\u25B6 ${label}`}
        </button>
    )
}

// Textarea with a used/max counter that turns amber within `warnAt` of the limit and red past it.
export function LimitedTextarea({ value, onChange, rows, placeholder, used, max, warnAt, unit, overMessage }: {
    value: string
    onChange: (value: string) => void
    rows: number
    placeholder: string
    used: number
    max: number
    warnAt: number
    unit?: string
    overMessage: string
}) {
    const left = max - used
    const over = left < 0
    return (
        <>
            <div className="relative">
                <textarea
                    className={[
                        'w-full px-3 py-2.5 rounded-lg text-sm text-gray-900 bg-white border resize-none',
                        'focus:outline-none focus:ring-1 transition-all duration-150',
                        'placeholder:text-gray-400 leading-relaxed',
                        over
                            ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                            : 'border-gray-200 focus:border-zoom-blue/60 focus:ring-zoom-blue/30',
                    ].join(' ')}
                    rows={rows}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                />
                <span className={[
                    'absolute bottom-2.5 right-3 text-[10px] font-mono tabular-nums pointer-events-none',
                    over ? 'text-red-500 font-semibold' : left < warnAt ? 'text-amber-500' : 'text-gray-400',
                ].join(' ')}>
                    {used.toLocaleString()} / {max.toLocaleString()}{unit && ` ${unit}`}
                </span>
            </div>
            {over && <p className="mt-1 text-xs text-red-500">{overMessage}</p>}
        </>
    )
}
