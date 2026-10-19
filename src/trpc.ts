import { initTRPC } from '@trpc/server'

import { UpstreamApiError } from './apiErrors.ts'

const t = initTRPC.create({
    errorFormatter({ shape, error }) {
        const upstream = error.cause instanceof UpstreamApiError ? error.cause : undefined
        return { ...shape, data: { ...shape.data, ...(upstream && { upstream: {
            status: upstream.status, request_id: upstream.requestId, retry_after: upstream.retryAfter, body: upstream.body,
        } }) } }
    },
})

export const router = t.router
export const procedure = t.procedure
