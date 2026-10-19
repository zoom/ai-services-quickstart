type FilePage<T> = { files: T[]; next_cursor?: string | null; raw_response?: unknown }

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

// Keep the visual list and Raw JSON list in sync while retaining upstream-only fields.
export function mergeFilePages<T>(previous: FilePage<T>, next: FilePage<T>) {
    const previousRaw = asRecord(previous.raw_response)
    const nextRaw = asRecord(next.raw_response)
    return {
        ...previous,
        ...next,
        files: [...previous.files, ...next.files],
        next_cursor: next.next_cursor,
        raw_response: {
            ...previousRaw,
            ...nextRaw,
            files: [
                ...(Array.isArray(previousRaw.files) ? previousRaw.files : previous.files),
                ...(Array.isArray(nextRaw.files) ? nextRaw.files : next.files),
            ],
            next_cursor: next.next_cursor,
        },
    }
}
