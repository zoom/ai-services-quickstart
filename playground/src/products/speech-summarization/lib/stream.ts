export type StreamEvent = { event: string; data: string }
export type Citation = { id: number; speaker?: string; start_time: string; end_time: string }
export type StreamStatus = 'idle' | 'transcribing' | 'summarizing' | 'completed' | 'failed' | 'cancelled'
export type SpeechStreamState = {
    status: StreamStatus; transcript: string; summary: string; citations: Citation[]
    summaryCompleted: boolean; done: boolean; error: string | null
}
export function initialSpeechState(): SpeechStreamState {
    return { status: 'idle', transcript: '', summary: '', citations: [], summaryCompleted: false, done: false, error: null }
}

// Keep incomplete frames in the buffer; stream chunks need not align with events.
export function parseSse(buffer: string): [StreamEvent[], string] {
    const blocks = buffer.split(/\r?\n\r?\n/)
    const rest = blocks.pop() ?? ''
    return [blocks.flatMap(block => {
        const lines = block.split(/\r?\n/)
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n')
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() ?? 'message'
        return data || event !== 'message' ? [{ event, data }] : []
    }), rest]
}

function message(error: unknown): string {
    return typeof error === 'string' ? error : JSON.stringify(error)
}
export function reduceSpeechEvent(state: SpeechStreamState, event: StreamEvent): SpeechStreamState {
    if (state.status === 'failed' || state.done) return state
    let data: Record<string, unknown> = {}
    try {
        const parsed: unknown = event.data ? JSON.parse(event.data) : {}
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected an event object')
        data = parsed as Record<string, unknown>
    } catch {
        return { ...state, status: 'failed', error: `Invalid ${event.event} event received.` }
    }
    if (event.event === 'error' || data.error != null || data.response_state === 'error') {
        return { ...state, status: 'failed', error: message(data.error ?? 'Summary generation failed.') }
    }
    if (event.event === 'transcribe_started') return { ...state, status: 'transcribing' }
    if (event.event === 'transcribe_complete') {
        const transcript = data.transcript as { result?: { text_display?: string } } | undefined
        return { ...state, status: 'summarizing', transcript: transcript?.result?.text_display ?? '' }
    }
    if (event.event === 'summary_updated') return {
        ...state, status: 'summarizing',
        summary: typeof data.summary_result === 'string' && data.summary_result ? data.summary_result : state.summary,
        citations: Array.isArray(data.citations) ? data.citations as Citation[] : state.citations,
        summaryCompleted: data.response_state === 'completed',
    }
    if (event.event === 'done') return state.summaryCompleted
        ? { ...state, done: true, status: 'completed' }
        : { ...state, status: 'failed', error: 'Stream ended without a completed summary.' }
    return state
}
export function finishSpeechStream(state: SpeechStreamState, remainder = ''): SpeechStreamState {
    if (state.status === 'failed') return state
    if (remainder.trim()) return { ...state, status: 'failed', error: 'Stream ended with an incomplete event.' }
    return state.done ? state : { ...state, status: 'failed', error: 'Connection ended before processing completed. Partial results are shown below.' }
}

export function withCitations(summary: string, citations: Citation[]): string {
    const ids = new Set(citations.map(citation => citation.id))
    const text = summary.replace(/\[\^(\d+)\]/g, (marker, id) => ids.has(Number(id)) ? marker : '').replace(/\[\^?\d*$/, '')
    return text + citations.map(citation => `\n\n[^${citation.id}]: ${citation.speaker ? `${citation.speaker} ` : ''}(${citation.start_time}–${citation.end_time})`).join('')
}
