import type { z } from 'zod'

// Validate the fields used by the visual view, and retain the exact upstream JSON.
// Keeping raw data separate also avoids tRPC losing optional field types to index signatures.
export function parseApiResponse<T extends z.ZodObject>(schema: T, data: unknown): z.output<T> & { raw_response: unknown } {
    return { ...schema.parse(data), raw_response: data }
}
