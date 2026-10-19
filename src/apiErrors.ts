import { TRPCError } from '@trpc/server'

export class UpstreamApiError extends Error {
    readonly status: number
    readonly body: unknown
    readonly requestId: string | null
    readonly retryAfter: string | null
    constructor(status: number, body: unknown, requestId: string | null = null, retryAfter: string | null = null, context?: string) {
        const details = typeof body === 'object' && body ? body as Record<string, unknown> : {}
        const nested = typeof details.error === 'object' && details.error ? details.error as Record<string, unknown> : {}
        const upstreamCode = nested.code ?? details.code
        const code = typeof upstreamCode === 'string' || typeof upstreamCode === 'number' ? ` (code ${upstreamCode})` : ''
        const reason = nested.message ?? details.message ?? details.error ?? body
        const message = typeof reason === 'string' ? reason : JSON.stringify(reason)
        const availability = status === 404 && context === 'clinical_notes'
            ? 'Clinical Notes route returned 404. Check the deployment route and account access. ' : ''
        const resolvedRequestId = requestId ?? (typeof details.request_id === 'string' ? details.request_id : null)
        const trace = resolvedRequestId ? ` (request ${resolvedRequestId})` : ''
        const retry = retryAfter ? ` Retry-After: ${retryAfter}.` : ''
        super(`${availability}Upstream HTTP ${status}${code}: ${message || 'Request failed'}${trace}${retry}`)
        this.name = 'UpstreamApiError'
        this.status = status
        this.body = body
        this.requestId = resolvedRequestId
        this.retryAfter = retryAfter
    }
}

export async function apiResponseError(response: Response, context?: string): Promise<UpstreamApiError> {
    const text = await response.text()
    let body: unknown = text || response.statusText
    try { body = JSON.parse(text) } catch { /* Plain text errors are valid too. */ }
    return new UpstreamApiError(response.status, body, response.headers.get('x-request-id') ?? response.headers.get('x-zm-request-id'), response.headers.get('retry-after'), context)
}

// Some upstream failures arrive as HTTP 200 with a top-level Zoom error envelope.
// A job's nested `error` field is valid job data, including FAILED/PARTIAL states.
export function apiResponseBodyError(response: Response, body: unknown, context?: string): UpstreamApiError | null {
    if (!body || typeof body !== 'object') return null
    const { code, message } = body as Record<string, unknown>
    const numericCode = typeof code === 'number' ? code : typeof code === 'string' && /^\d+$/.test(code) ? Number(code) : 0
    if (!numericCode || typeof message !== 'string') return null
    return new UpstreamApiError(response.status, body, response.headers.get('x-request-id') ?? response.headers.get('x-zm-request-id'), response.headers.get('retry-after'), context)
}

export function asTrpcError(error: UpstreamApiError): TRPCError {
    const code = error.status === 400 || error.status === 422 ? 'BAD_REQUEST'
        : error.status === 401 ? 'UNAUTHORIZED' : error.status === 403 ? 'FORBIDDEN'
            : error.status === 404 ? 'NOT_FOUND' : error.status === 413 ? 'PAYLOAD_TOO_LARGE'
                : error.status === 429 ? 'TOO_MANY_REQUESTS' : 'BAD_GATEWAY'
    return new TRPCError({ code, message: error.message, cause: error })
}
