import { KJUR } from 'jsrsasign'
import dotenv from 'dotenv'
dotenv.config()

export type AwsCredentials = {
    access_key_id: string
    secret_access_key: string
    session_token?: string
}

const ZOOM_API_KEY = process.env.ZOOM_API_KEY
const ZOOM_API_SECRET = process.env.ZOOM_API_SECRET
export const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2'

if (!ZOOM_API_KEY || !ZOOM_API_SECRET) {
    throw new Error('ZOOM_API_KEY and ZOOM_API_SECRET are required')
}

export const generateJWT = () => {
    const iat = Math.round(Date.now() / 1000) - 30
    const exp = iat + 60 * 60 * 1
    return KJUR.jws.JWS.sign('HS256', JSON.stringify({ alg: 'HS256', typ: 'JWT' }), JSON.stringify({ iss: ZOOM_API_KEY, iat, exp }), ZOOM_API_SECRET)
}

export function getEnvAwsCredentials(): AwsCredentials | undefined {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return undefined
    return {
        access_key_id: process.env.AWS_ACCESS_KEY_ID,
        secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
        ...(process.env.AWS_SESSION_TOKEN && { session_token: process.env.AWS_SESSION_TOKEN }),
    }
}

export function isS3(value?: string): boolean {
    return value?.toLowerCase() === 's3'
}

export function withAwsAuth<T extends { auth?: { aws?: AwsCredentials } }>(value: T | undefined, aws: AwsCredentials | undefined): T | undefined {
    if (!value) return undefined
    if (!aws) return value
    return { ...value, auth: { ...(value.auth ?? {}), aws } }
}

// Authenticated request to an AI Services path, e.g. zoomFetch('/scribe/transcribe'). Returns the raw
// Response, for callers that stream it; most code uses createApiRequest instead.
export function zoomFetch(path: string, init: RequestInit = {}) {
    return fetch(`${ZOOM_API_BASE_URL}/aiservices${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${generateJWT()}`, ...init.headers },
    })
}

// JSON requests to one AI service, e.g. createApiRequest('scribe'). Pass `json` to POST a JSON body,
// or `body` (e.g. FormData) with `method: 'POST'` for anything else.
export function createApiRequest(service: string) {
    return async function makeRequest(path: string, { json, ...init }: RequestInit & { json?: unknown } = {}) {
        const res = await zoomFetch(`/${service}${path}`, {
            ...init,
            ...(json !== undefined && { method: 'POST', body: JSON.stringify(json) }),
            headers: {
                ...(json !== undefined && { 'Content-Type': 'application/json' }),
                ...init.headers,
            },
        })
        if (!res.ok) throw new Error(await res.text() || res.statusText)
        if (res.status === 204) return null
        return res.json()
    }
}

export type ApiRequest = ReturnType<typeof createApiRequest>
