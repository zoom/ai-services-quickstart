import type { Server } from 'node:http'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { generateJWT, ZOOM_API_BASE_URL } from '../util.ts'

const WSS_ROOT = ZOOM_API_BASE_URL.replace(/^https/, 'wss')

// Browser path -> Zoom WebSocket endpoint and subprotocol. The relay injects a fresh JWT,
// because browsers can't set the Authorization header on a WebSocket.
const ROUTES: Record<string, { endpoint: string; protocol: string }> = {
    '/live/scribe': { endpoint: `${WSS_ROOT}/aiservices/scribe/live`, protocol: 'live-asr' },
    // Voice Agent is served under the /ws root path.
    '/live/voice-agent': { endpoint: `${WSS_ROOT}/ws/aiservices/voice-agent/live`, protocol: 'voice-agent.zoom.v2' },
}
const MAX_QUEUED_BYTES = 8 * 1024 * 1024
const MAX_QUEUED_FRAMES = 256

function frameSize(data: RawData): number {
    if (Buffer.isBuffer(data)) return data.length
    if (data instanceof ArrayBuffer) return data.byteLength
    return data.reduce((bytes, chunk) => bytes + chunk.length, 0)
}

export function attachLiveRelays(server: Server) {
    // noServer: route the upgrade ourselves so only the live paths are proxied.
    const wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (req, socket, head) => {
        const { pathname } = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
        const route = ROUTES[pathname]
        if (route) {
            wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, route))
        } else {
            socket.destroy()
        }
    })

    wss.on('connection', (client: WebSocket, route: { endpoint: string; protocol: string }) => {
        const upstream = new WebSocket(route.endpoint, [route.protocol], {
            headers: { Authorization: `Bearer ${generateJWT()}` },
            perMessageDeflate: false, // audio barely compresses; skip per-frame zlib work
        })
        const queue: Array<[RawData, boolean]> = [] // buffer client frames until upstream opens
        let queuedBytes = 0
        let failed = false
        const closeUpstream = () => {
            if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate()
            else if (upstream.readyState === WebSocket.OPEN) upstream.close(1000)
        }

        upstream.on('open', () => {
            if (client.readyState !== WebSocket.OPEN) {
                upstream.close()
                return
            }
            client.send(JSON.stringify({ type: 'relay.ready' }))
            for (const [data, isBinary] of queue) upstream.send(data, { binary: isBinary })
            queue.length = 0
            queuedBytes = 0
        })
        upstream.on('message', (data, isBinary) => {
            if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary })
        })
        upstream.on('close', () => {
            if (client.readyState === WebSocket.OPEN) client.close(1000)
        })

        const fail = (message: string, code = 1011) => {
            if (failed) return
            failed = true
            console.error('[live]', message)
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'error',
                    error: {
                        code: 'relay_error',
                        message,
                        fatal: true,
                    },
                }))
                client.close(code)
            }
            upstream.terminate()
        }

        // Handshake rejected by Zoom: ws reports these as a bare "Unexpected server response: <code>".
        // Translate the status into something the developer can act on. Handling this event also
        // suppresses the otherwise-duplicate 'error' emission.
        upstream.on('unexpected-response', (_req, res) => {
            const status = res.statusCode
            const hint =
                status === 401 || status === 403
                    ? 'Zoom rejected the token (401/403). Check ZOOM_API_KEY / ZOOM_API_SECRET.'
                    : status === 404
                        ? 'Endpoint returned 404 — the credentials likely aren\'t provisioned for Build Account or Universal Credit.'
                        : status === 429
                            ? 'Rate limited by Zoom (429). Retry shortly.'
                            : `Zoom returned HTTP ${status} on the WebSocket handshake.`
            fail(hint)
            res.resume() // drain so the socket can be freed
        })

        upstream.on('error', (err) => fail(`Live connection error: ${err.message}`))

        client.on('message', (data, isBinary) => {
            if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary })
            else if (upstream.readyState === WebSocket.CONNECTING) {
                const bytes = frameSize(data)
                if (queue.length >= MAX_QUEUED_FRAMES || queuedBytes + bytes > MAX_QUEUED_BYTES) {
                    fail('Too much audio arrived before the live connection was ready.', 1009)
                    return
                }
                queue.push([data, isBinary])
                queuedBytes += bytes
            }
        })
        client.on('close', closeUpstream)
        client.on('error', closeUpstream)
    })

}
