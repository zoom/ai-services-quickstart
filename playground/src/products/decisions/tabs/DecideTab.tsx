import { useState } from 'react'
import { Card, ErrorNote, Field, SectionHeading, SubmitButton } from '../../../components/ui'
import { JsonResult } from '../../../components/JsonResult'
import { inputCls, selectCls } from '../../../lib/constants'
import { readFileAsDataUri } from '../../../lib/utils'
import { trpc, type RouterInputs } from '../../../lib/trpc'
import { choiceValueKey } from '../../../../../src/decisions/schema'

type Questions = RouterInputs['decisions']['decide']['questions']
type QuestionType = 'predicate' | 'choice' | 'score'

// Editable form state for one question; converted to the API shape by toQuestions().
type Draft = {
    id: number
    type: QuestionType
    name: string
    instructions: string
    booleanChoices: boolean
    choices: Array<{ value: string; description: string }>
    levels: Array<{ label: string; description: string }>
}

const TYPE_META: Record<QuestionType, { label: string; glyph: string; hint: string; accent: string; soft: string }> = {
    predicate: { label: 'Predicate', glyph: '◐', hint: 'Probability a condition is true', accent: 'text-emerald-600', soft: 'bg-emerald-50' },
    choice: { label: 'Choice', glyph: '⑂', hint: 'Pick one of your options', accent: 'text-zoom-blue', soft: 'bg-zoom-blue/5' },
    score: { label: 'Score', glyph: '▤', hint: 'Rate against ordered levels', accent: 'text-amber-600', soft: 'bg-amber-50' },
}

let nextId = 1
const blank = (type: QuestionType, patch: Partial<Draft> = {}): Draft => ({
    id: nextId++,
    type,
    name: '',
    instructions: '',
    booleanChoices: false,
    choices: [{ value: '', description: '' }, { value: '', description: '' }],
    levels: [{ label: 'Low', description: '' }, { label: 'Medium', description: '' }, { label: 'High', description: '' }],
    ...patch,
})

const TEMPLATES: Array<{ label: string; input: string; questions: () => Draft[] }> = [
    {
        label: 'Escalate an incident',
        input: 'Our production deployment has failed and all customers are unable to sign in.',
        questions: () => [blank('predicate', { name: 'needs_escalation', instructions: 'Does this customer request require escalation?' })],
    },
    {
        label: 'Route a request',
        input: 'I was charged twice for my subscription this month. Please refund the duplicate charge.',
        questions: () => [blank('choice', {
            name: 'route',
            instructions: 'Which team should handle this customer request?',
            choices: [
                { value: 'sales', description: 'Sales inquiries and purchasing.' },
                { value: 'support', description: 'Technical issues and product assistance.' },
                { value: 'billing', description: 'Payments, invoices, and refunds.' },
            ],
        })],
    },
    {
        label: 'Triage a bug',
        input: 'The Export button does nothing in Safari. I can still download the report in Chrome.',
        questions: () => [blank('score', {
            name: 'severity',
            instructions: 'Rate how much this bug prevents the user from completing their task.',
            levels: [
                { label: 'Cosmetic', description: 'A visual issue that does not affect the task.' },
                { label: 'Workaround available', description: 'The task is disrupted but can be completed.' },
                { label: 'Fully blocked', description: 'The user cannot complete the task.' },
            ],
        })],
    },
    {
        label: 'All three at once',
        input: 'Production is down for every customer and I was also charged twice. Please help urgently!',
        questions: () => [
            blank('predicate', { name: 'needs_escalation', instructions: 'Does this require escalation?' }),
            blank('choice', { name: 'route', instructions: 'Which team should handle this?', choices: [{ value: 'support', description: 'Technical issues.' }, { value: 'billing', description: 'Payments and refunds.' }] }),
            blank('score', { name: 'urgency', instructions: 'How urgent is this?', levels: [{ label: 'Low', description: '' }, { label: 'Medium', description: '' }, { label: 'High', description: '' }, { label: 'Critical', description: '' }] }),
        ],
    },
]

const clean = (s: string) => s.trim() || undefined

function toQuestions(drafts: Draft[]): Questions {
    return drafts.map(d => {
        const common = { name: d.name.trim(), instructions: d.instructions.trim() }
        if (d.type === 'choice') return {
            ...common,
            type: 'choice',
            choices: d.booleanChoices
                ? d.choices.slice(0, 2).map((c, i) => ({ value: i === 0, description: clean(c.description) }))
                : d.choices.map(c => ({ value: c.value.trim(), description: clean(c.description) })),
        }
        if (d.type === 'score') return {
            ...common,
            type: 'score',
            levels: d.levels.map(l => ({ label: l.label.trim(), description: clean(l.description) })),
        }
        return { ...common, type: 'predicate' }
    })
}

// Returns a message per invalid question (keyed by draft id).
function validate(drafts: Draft[]): Record<number, string> {
    const issues: Record<number, string> = {}
    const names = drafts.map(d => d.name.trim()).filter(Boolean)
    for (const d of drafts) {
        const values = d.choices.map(c => c.value.trim()).filter(Boolean)
        if (!d.name.trim()) issues[d.id] = 'Add a name for this question.'
        else if (!d.instructions.trim()) issues[d.id] = 'Add instructions describing what to evaluate.'
        else if (names.filter(n => n === d.name.trim()).length > 1) issues[d.id] = 'Names must be unique.'
        else if (d.type === 'choice' && !d.booleanChoices && values.length < 2) issues[d.id] = 'Add at least two choices.'
        else if (d.type === 'choice' && !d.booleanChoices && d.choices.some(c => !c.value.trim())) issues[d.id] = 'Every choice needs a value.'
        else if (d.type === 'choice' && !d.booleanChoices && new Set(values).size !== values.length) issues[d.id] = 'Choice values must be unique.'
        else if (d.type === 'score' && d.levels.filter(l => l.label.trim()).length < 2) issues[d.id] = 'Add at least two levels.'
        else if (d.type === 'score' && d.levels.some(l => !l.label.trim())) issues[d.id] = 'Every level needs a label.'
    }
    return issues
}

// Row inputs size themselves (fixed value column, flexible description), so drop inputCls' w-full.
const miniInput = inputCls.replace('w-full ', '').replace('px-3 py-2', 'px-2.5 py-1.5') + ' min-w-0'
const grow = ' flex-1'
const iconBtn = 'h-7 w-7 shrink-0 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors'

function RowList<T>({ items, onChange, render, make, addLabel, ordered, min }: {
    items: T[]
    onChange: (items: T[]) => void
    render: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode
    make: () => T
    addLabel: string
    ordered?: boolean
    min: number
}) {
    const update = (i: number, patch: Partial<T>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
    const move = (i: number, by: number) => {
        const next = [...items]
            ;[next[i], next[i + by]] = [next[i + by], next[i]]
        onChange(next)
    }
    return (
        <div className="flex flex-col gap-1.5">
            {items.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5" style={{ animation: 'riseIn .2s ease both' }}>
                    {render(item, patch => update(i, patch), i)}
                    {ordered && (
                        <>
                            <button type="button" aria-label="Move up" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                            <button type="button" aria-label="Move down" className={iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
                        </>
                    )}
                    <button type="button" aria-label="Remove" className={iconBtn} disabled={items.length <= min} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...items, make()])} className="self-start mt-1 text-xs font-medium text-zoom-blue hover:text-zoom-blue-hover">
                + {addLabel}
            </button>
        </div>
    )
}

function QuestionCard({ draft, index, issue, onChange, onRemove, onDuplicate, canRemove }: {
    draft: Draft
    index: number
    issue?: string
    onChange: (patch: Partial<Draft>) => void
    onRemove: () => void
    onDuplicate: () => void
    canRemove: boolean
}) {
    const meta = TYPE_META[draft.type]
    return (
        <div className="relative rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ animation: 'riseIn .25s ease both' }}>
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
                <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500">
                    <span className="tabular-nums text-gray-300">Q{index + 1}</span>
                    {/* type switcher: segmented control tinted by the active type */}
                    <span role="radiogroup" className="flex rounded-lg bg-gray-100 p-0.5">
                        {(Object.keys(TYPE_META) as QuestionType[]).map(t => (
                            <button
                                key={t}
                                type="button"
                                role="radio"
                                aria-checked={draft.type === t}
                                title={TYPE_META[t].hint}
                                onClick={() => onChange({ type: t })}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${draft.type === t ? `bg-white shadow-sm ${TYPE_META[t].accent}` : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <span className="mr-1">{TYPE_META[t].glyph}</span>{TYPE_META[t].label}
                            </button>
                        ))}
                    </span>
                </span>
                <span className="flex items-center gap-1">
                    <button type="button" onClick={onDuplicate} className="px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100">Duplicate</button>
                    <button type="button" onClick={onRemove} disabled={!canRemove} className="px-2 py-1 rounded-md text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500">Remove</button>
                </span>
            </div>

            <div className="p-4 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_2.2fr] gap-3">
                    <input className={inputCls + ' font-mono text-xs'} value={draft.name} onChange={e => onChange({ name: e.target.value })} placeholder="name (required)" aria-label="Question name" required />
                    <input className={inputCls} value={draft.instructions} onChange={e => onChange({ instructions: e.target.value })} placeholder={draft.type === 'predicate' ? 'Does this request require escalation?' : draft.type === 'choice' ? 'Which team should handle this?' : 'How severe is this issue?'} aria-label="Instructions" />
                </div>

                {draft.type === 'predicate' && (
                    <p className={`text-xs ${meta.accent} ${meta.soft} rounded-lg px-3 py-2`}>Returns a probability from 0 to 1 that the statement is true. Pick your own threshold for acting on it.</p>
                )}

                {draft.type === 'choice' && (
                    <div className={`rounded-lg ${meta.soft} p-3 flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Choices</span>
                            <span className="flex rounded-md bg-white/70 p-0.5 text-[11px]">
                                {([false, true] as const).map(b => (
                                    <button key={String(b)} type="button" onClick={() => onChange({ booleanChoices: b })}
                                        className={`px-2 py-0.5 rounded ${draft.booleanChoices === b ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>
                                        {b ? 'true / false' : 'Text values'}
                                    </button>
                                ))}
                            </span>
                        </div>
                        {draft.booleanChoices ? (
                            (['true', 'false'] as const).map((v, i) => (
                                <div key={v} className="flex items-center gap-1.5">
                                    <code className="w-24 shrink-0 text-xs font-mono text-zoom-blue px-2.5 py-1.5 rounded-lg bg-white border border-gray-200">{v}</code>
                                    <input className={miniInput + grow} value={draft.choices[i]?.description ?? ''} placeholder="When this applies (optional)"
                                        onChange={e => onChange({ choices: [0, 1].map(j => (j === i ? { value: v, description: e.target.value } : draft.choices[j] ?? { value: '', description: '' })) })} />
                                </div>
                            ))
                        ) : (
                            <RowList
                                items={draft.choices}
                                onChange={choices => onChange({ choices })}
                                make={() => ({ value: '', description: '' })}
                                addLabel="Add choice"
                                min={2}
                                render={(c, update) => (
                                    <>
                                        <input className={miniInput + ' w-36 shrink-0 font-mono text-xs'} value={c.value} onChange={e => update({ value: e.target.value })} placeholder="value" />
                                        <input className={miniInput + grow} value={c.description} onChange={e => update({ description: e.target.value })} placeholder="When to pick it (optional)" />
                                    </>
                                )}
                            />
                        )}
                    </div>
                )}

                {draft.type === 'score' && (
                    <div className={`rounded-lg ${meta.soft} p-3 flex flex-col gap-2`}>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Levels · lowest to highest</span>
                        <RowList
                            items={draft.levels}
                            onChange={levels => onChange({ levels })}
                            make={() => ({ label: '', description: '' })}
                            addLabel="Add level"
                            ordered
                            min={2}
                            render={(l, update, i) => (
                                <>
                                    {/* index badge deepens with the level, a small visual ramp */}
                                    <span className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-[11px] font-semibold tabular-nums text-amber-900"
                                        style={{ background: `rgba(245, 158, 11, ${0.15 + (0.6 * i) / Math.max(1, draft.levels.length - 1)})` }}>
                                        {i}
                                    </span>
                                    <input className={miniInput + ' w-40 shrink-0'} value={l.label} onChange={e => update({ label: e.target.value })} placeholder="Label" />
                                    <input className={miniInput + grow} value={l.description} onChange={e => update({ description: e.target.value })} placeholder="Description (optional)" />
                                </>
                            )}
                        />
                    </div>
                )}

                {issue && <p className="text-xs text-red-500">{issue}</p>}
            </div>
        </div>
    )
}

type Distribution = Array<{ value: unknown; label?: string | null; probability: number }>
type Answer = { type: string; name?: string; probability?: number; choice?: unknown; score?: number; probabilities?: Distribution; confidence?: number | null }

const pct = (p: number) => `${Math.round(p * 100)}%`

function Bars({ rows, winner, tone }: { rows: Array<{ label: string; p: number }>; winner?: string; tone: string }) {
    return (
        <div className="flex flex-col gap-1.5">
            {rows.map(r => (
                <div key={r.label} className="grid grid-cols-[minmax(0,7rem)_1fr_2.5rem] items-center gap-2 text-xs">
                    <span className={`truncate ${r.label === winner ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{r.label}</span>
                    <span className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <span className={`block h-full rounded-full ${r.label === winner ? tone : 'bg-gray-300'}`} style={{ width: pct(r.p), transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
                    </span>
                    <span className="text-right tabular-nums text-gray-500">{pct(r.p)}</span>
                </div>
            ))}
        </div>
    )
}

type Question = Questions[number]

function ScoreAnswer({ answer, levelLabel }: { answer: Answer; levelLabel: (i: number) => string }) {
    const dist = answer.probabilities ?? []
    const max = Math.max(1, dist.length - 1)
    const score = answer.score ?? 0
    return (
        <>
            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-semibold tabular-nums text-gray-900">{score.toFixed(2)}</span>
                <span className="text-xs text-gray-500">≈ {levelLabel(Math.round(score))}</span>
            </div>
            {/* scale with a marker at the probability-weighted score */}
            <div className="relative h-2 rounded-full mb-3" style={{ background: 'linear-gradient(90deg, rgba(245,158,11,.15), rgba(245,158,11,.75))' }}>
                <span className="absolute -top-1 h-4 w-1 rounded-full bg-gray-900" style={{ left: `calc(${(score / max) * 100}% - 2px)`, transition: 'left .6s cubic-bezier(.2,.8,.2,1)' }} />
            </div>
            <Bars tone="bg-amber-500" winner={levelLabel(Math.round(score))}
                rows={dist.map(p => ({ label: p.label ?? levelLabel(Number(p.value)), p: p.probability }))} />
        </>
    )
}

// `question` is the question as sent, so level labels match the response even if the form changed since.
function AnswerCard({ answer, question }: { answer: Answer; question?: Question }) {
    const meta = TYPE_META[answer.type as QuestionType] as (typeof TYPE_META)[QuestionType] | undefined
    const levelLabel = (i: number) => (question?.type === 'score' ? question.levels[i]?.label : undefined) ?? `Level ${i}`

    return (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5" style={{ animation: 'riseIn .3s ease both' }}>
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{meta ? `${meta.glyph} ` : ''}{answer.name ?? question?.instructions ?? answer.type}</span>
                {answer.confidence != null && <span className="text-[11px] text-gray-400 tabular-nums">confidence {pct(answer.confidence)}</span>}
            </div>

            {answer.type === 'predicate' && (
                <div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tabular-nums text-gray-900">{pct(answer.probability ?? 0)}</span>
                        <span className="text-xs text-gray-500">likely true</span>
                    </div>
                    <span className="mt-2 block h-2 rounded-full bg-gray-100 overflow-hidden">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: pct(answer.probability ?? 0), transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
                    </span>
                </div>
            )}

            {answer.type === 'choice' && (
                <>
                    <p className="text-lg font-semibold text-gray-900 mb-2 font-mono">{String(answer.choice)}</p>
                    <Bars tone="bg-zoom-blue" winner={choiceValueKey(answer.choice)} rows={(answer.probabilities ?? []).map(p => ({ label: choiceValueKey(p.value) ?? String(p.value), p: p.probability }))} />
                </>
            )}

            {answer.type === 'score' && <ScoreAnswer answer={answer} levelLabel={levelLabel} />}

            {answer.type === 'refusal' && <p className="text-sm text-gray-500">The service declined to answer this question.</p>}
        </div>
    )
}

export function DecideTab() {
    const [input, setInput] = useState(TEMPLATES[0].input)
    const [drafts, setDrafts] = useState<Draft[]>(TEMPLATES[0].questions)
    const [model, setModel] = useState<'zoom-decisions-standard' | 'zoom-decisions-pro'>('zoom-decisions-standard')
    const [image, setImage] = useState<string | null>(null) // inline data URL
    const [detail, setDetail] = useState<'auto' | 'low' | 'high' | 'original'>('auto')
    const [showJson, setShowJson] = useState(false)
    const decide = trpc.decisions.decide.useMutation()

    const issues = validate(drafts)
    const questions = toQuestions(drafts)
    const valid = Object.keys(issues).length === 0 && input.trim().length > 0

    // With an image, input becomes a user message with text and image parts, and image input must be enabled.
    const request: RouterInputs['decisions']['decide'] = image
        ? { input: [{ role: 'user', content: [{ type: 'input_text', text: input }, { type: 'input_image', image_url: image, detail }] }], questions, model, enable_image_input: true }
        : { input, questions, model }

    const update = (id: number, patch: Partial<Draft>) => setDrafts(ds => ds.map(d => (d.id === id ? { ...d, ...patch } : d)))
    const answers = (decide.data?.answers ?? []) as Answer[]

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <form id="decisions-form" onSubmit={e => { e.preventDefault(); if (valid) decide.mutate(request) }} className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Start from an example" />
                    <div className="flex flex-wrap gap-2">
                        {TEMPLATES.map(t => (
                            <button key={t.label} type="button" onClick={() => { setInput(t.input); setDrafts(t.questions()); decide.reset() }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:border-zoom-blue/40 hover:text-zoom-blue transition-colors">
                                {t.label}
                            </button>
                        ))}
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-col gap-4">
                        <Field label="Input" hint="The shared evidence every question evaluates">
                            <textarea className={inputCls + ' resize-none'} rows={3} value={input} onChange={e => setInput(e.target.value)} />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4 items-end">
                            <Field label="Image (optional)" hint="Sent inline as a data URL with enable_image_input">
                                <input type="file" accept="image/*" className="block w-full text-sm text-gray-500 cursor-pointer file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-solid file:border-gray-200 file:bg-white file:text-sm file:font-medium file:text-gray-900 file:cursor-pointer hover:file:bg-gray-50 file:transition-colors" onChange={async e => {
                                    const file = e.target.files?.[0]
                                    setImage(file ? await readFileAsDataUri(file) : null)
                                }} />
                            </Field>
                            <Field label="Image detail" hint="">
                                <select className={selectCls} value={detail} disabled={!image} onChange={e => setDetail(e.target.value as typeof detail)}>
                                    {(['auto', 'low', 'high', 'original'] as const).map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </Field>
                        </div>
                        {image && <img src={image} alt="Selected input" className="max-h-40 rounded-lg border border-gray-200 self-start" />}
                        <Field label="Model" hint="Pro is optimized for higher accuracy">
                            <select className={selectCls} value={model} onChange={e => setModel(e.target.value as typeof model)}>
                                <option value="zoom-decisions-standard">zoom-decisions-standard</option>
                                <option value="zoom-decisions-pro">zoom-decisions-pro</option>
                            </select>
                        </Field>
                    </div>
                </Card>

                <div className="flex flex-col gap-3">
                    <div className="flex items-end justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 tracking-wide">Questions</h2>
                            <p className="text-xs text-gray-500">Each is evaluated independently against the same input.</p>
                        </div>
                        <span className="text-[11px] text-gray-400 tabular-nums">{drafts.length} question{drafts.length === 1 ? '' : 's'}</span>
                    </div>

                    {drafts.map((d, i) => (
                        <QuestionCard
                            key={d.id}
                            draft={d}
                            index={i}
                            issue={issues[d.id]}
                            canRemove={drafts.length > 1}
                            onChange={patch => update(d.id, patch)}
                            onRemove={() => setDrafts(ds => ds.filter(x => x.id !== d.id))}
                            onDuplicate={() => setDrafts(ds => {
                                const at = ds.findIndex(x => x.id === d.id)
                                return [...ds.slice(0, at + 1), { ...d, id: nextId++, name: d.name ? `${d.name}_copy` : '' }, ...ds.slice(at + 1)]
                            })}
                        />
                    ))}

                    {/* add a question of a specific type */}
                    <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(TYPE_META) as QuestionType[]).map(t => (
                            <button key={t} type="button" onClick={() => setDrafts(ds => [...ds, blank(t)])}
                                className="group rounded-xl border-2 border-dashed border-gray-200 bg-white/50 px-3 py-3 text-left hover:border-gray-300 hover:bg-white transition-all">
                                <span className={`block text-sm font-medium ${TYPE_META[t].accent}`}>+ {TYPE_META[t].glyph} {TYPE_META[t].label}</span>
                                <span className="block text-[11px] text-gray-500 leading-snug">{TYPE_META[t].hint}</span>
                            </button>
                        ))}
                    </div>

                    <button type="button" onClick={() => setShowJson(s => !s)} className="self-start text-xs text-gray-500 hover:text-gray-800">
                        {showJson ? '▾' : '▸'} Request JSON
                    </button>
                    {showJson && (
                        <pre className="rounded-xl border border-gray-200 bg-zoom-surface p-4 text-[11px] font-mono text-gray-700 overflow-auto max-h-80">
                            {JSON.stringify({ ...request, ...(image && { input: '[text + image omitted]' }) }, null, 2)}
                        </pre>
                    )}
                </div>
            </form>

            <div className="lg:sticky lg:top-20 flex flex-col gap-3">
                <SubmitButton form="decisions-form" busy={decide.isPending} disabled={!valid} label="Run decision" busyLabel="Deciding..." />
                {!valid && !decide.isPending && <p className="text-xs text-gray-500">Fix the highlighted questions to run.</p>}
                {decide.error && <ErrorNote>{decide.error.message}</ErrorNote>}
                {/* Answers come back in request order. */}
                {answers.map((a, i) => <AnswerCard key={i} answer={a} question={decide.variables?.questions[i]} />)}
                <JsonResult data={decide.data ?? null} loading={decide.isPending} />
            </div>
        </div>
    )
}
