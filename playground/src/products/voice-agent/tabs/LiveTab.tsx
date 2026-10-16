import { useState } from 'react'
import { Card, ErrorNote, Field, SectionHeading, ToggleRow } from '../../../components/ui'
import { EventLog } from '../../../components/EventLog'
import { inputCls, selectCls } from '../../../lib/constants'
import { useVoiceAgent, type VoiceAgentOptions } from '../lib/useVoiceAgent'

const VOICES = ['jenna', 'alex', 'ariel', 'ava', 'brooke', 'hazel', 'mark', 'reid', 'scott', 'tony']

export function LiveTab() {
    const [options, setOptions] = useState<VoiceAgentOptions>({
        voice: 'jenna',
        instructions: 'You are a concise and friendly support agent. Use get_current_time when asked for the time.',
        phrases: '',
        functionCalling: true,
        reasoningEffort: '',
    })
    const set = (patch: Partial<VoiceAgentOptions>) => setOptions(o => ({ ...o, ...patch }))
    const { status, lines, events, error, start, stop } = useVoiceAgent()
    const active = status === 'live' || status === 'connecting'

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start gap-5">
            <div className="flex flex-col gap-5">
                <Card>
                    <SectionHeading title="Session Config" />
                    <fieldset disabled={active} className="grid grid-cols-1 sm:grid-cols-3 gap-4 disabled:opacity-60">
                        <div className="sm:col-span-3">
                            <Field label="Instructions" hint="Persistent instructions for the agent">
                                <input className={inputCls} value={options.instructions} onChange={e => set({ instructions: e.target.value })} />
                            </Field>
                        </div>
                        <Field label="Voice" hint="16 kHz PCM16 output">
                            <select className={selectCls} value={options.voice} onChange={e => set({ voice: e.target.value })}>
                                {VOICES.map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
                            </select>
                        </Field>
                        <Field label="Context phrases" hint="Comma-separated names and terms">
                            <input className={inputCls} value={options.phrases} placeholder="Zoom, Voice Agent" onChange={e => set({ phrases: e.target.value })} />
                        </Field>
                        <Field label="Reasoning effort" hint="Default omits reasoning">
                            <select className={selectCls} value={options.reasoningEffort} onChange={e => set({ reasoningEffort: e.target.value as VoiceAgentOptions['reasoningEffort'] })}>
                                <option value="">Default</option>
                                {(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </Field>
                        <ToggleRow label="Function calling" hint="Demo tool: get_current_time" checked={options.functionCalling} onChange={v => set({ functionCalling: v })} />
                    </fieldset>
                    <div className="mt-5 flex items-center gap-4">
                        <button
                            type="button"
                            onClick={active ? stop : () => start(options)}
                            className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 ${active ? 'bg-red-500 hover:bg-red-600' : 'bg-zoom-blue hover:bg-zoom-blue-hover'}`}
                        >
                            {active ? '■ End conversation' : '● Start conversation'}
                        </button>
                        <span className="text-xs text-gray-500">
                            {status === 'connecting' ? 'Connecting…' : status === 'live' ? 'Listening — speak to the agent. Talk over it to interrupt.' : 'Uses your microphone and speakers.'}
                        </span>
                    </div>
                    {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
                </Card>

                <Card>
                    <SectionHeading title="Conversation" />
                    <div className="min-h-44 max-h-[42vh] overflow-auto flex flex-col gap-2">
                        {lines.length === 0
                            ? <span className="text-sm text-gray-300 italic">Your words and the agent's replies appear here…</span>
                            : lines.map(line => (
                                <p key={line.id} className={`text-sm leading-relaxed ${line.role === 'user' ? 'text-gray-800' : 'text-zoom-blue'}`}>
                                    <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{line.role === 'user' ? 'You' : 'Agent'}</span>
                                    {line.text}
                                </p>
                            ))}
                    </div>
                </Card>
            </div>

            <EventLog title="Voice Agent events (deltas hidden)" events={events} empty="Raw events stream in here…" />
        </div>
    )
}
