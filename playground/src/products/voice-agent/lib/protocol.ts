export type ToolChoice = 'auto' | 'none' | 'required'
export type VoiceAgentOptions = {
    voice: string
    instructions: string
    phrases: string
    functionCalling: boolean
    responseTokenLimit: number | 'inf'
    toolChoice: ToolChoice
}

export const SAMPLE_RATE = 16000
export const TOOLS = [{
    type: 'function',
    name: 'get_current_time',
    description: 'Get the current date and time for an IANA time zone, such as America/Los_Angeles.',
    parameters: { type: 'object', properties: { time_zone: { type: 'string', description: 'IANA time zone name' } }, required: ['time_zone'] },
}]

export function sessionUpdate(options: VoiceAgentOptions) {
    const phrases = options.phrases.split(',').map(p => p.trim()).filter(Boolean)
    return {
        type: 'session.update',
        session: {
            type: 'realtime',
            listen: {
                format: { type: 'pcm16', rate: SAMPLE_RATE },
                transcription: { language: 'en', ...(phrases.length && { vocabulary: { phrases } }) },
            },
            think: {
                provider: { type: 'zoom', model: 'gemma-4' },
                instructions: options.instructions,
                response_token_limit: options.responseTokenLimit,
                tools: options.functionCalling ? TOOLS : [],
                tool_choice: options.functionCalling ? options.toolChoice : 'none',
            },
            speak: { format: { type: 'pcm16' }, voice: options.voice },
        },
    }
}

export type AudioChunk = { startsAt: number; duration: number; offset: number }
// Count only samples already played, including gaps between scheduled chunks.
export function playedAudioMs(chunks: AudioChunk[], currentTime: number) {
    let seconds = 0
    for (const chunk of chunks) {
        if (currentTime <= chunk.startsAt) break
        seconds = chunk.offset + Math.min(chunk.duration, currentTime - chunk.startsAt)
    }
    return Math.max(0, Math.floor(seconds * 1000))
}

export function interruptionEvents(responseId: string | null, item: { id: string; contentIndex: number; playedMs: number } | null) {
    return [
        ...(responseId ? [{ type: 'response.cancel', response_id: responseId }] : []),
        ...(item ? [{ type: 'conversation.item.truncate', item_id: item.id, content_index: item.contentIndex, audio_end_ms: item.playedMs }] : []),
    ]
}

export function responseFailure(response: { status?: string; status_details?: unknown }) {
    if (response.status === 'failed' || response.status === 'incomplete') {
        const detail = response.status_details ? `: ${JSON.stringify(response.status_details)}` : ''
        return `Response ${response.status}${detail}`
    }
    return null
}

export function shouldFollowUp(status: string | undefined, hasToolResult: boolean, interrupted: boolean) {
    return status === 'completed' && hasToolResult && !interrupted
}

// Never assign late events to the latest response. In particular, response.done
// without an ID cannot safely terminate a newer response or trigger its tools.
export function responseIdentity(event: { response_id?: unknown; response?: { id?: unknown }; item_id?: unknown }, itemResponses: ReadonlyMap<string, string>) {
    if (typeof event.response_id === 'string') return event.response_id
    if (typeof event.response?.id === 'string') return event.response.id
    if (typeof event.item_id === 'string') return itemResponses.get(event.item_id) ?? null
    return null
}

export function cancellationTarget(activeResponse: string | null, interrupted: ReadonlySet<string>) {
    return activeResponse && !interrupted.has(activeResponse) ? activeResponse : null
}
