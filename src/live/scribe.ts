import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { generateJWT } from '../util.ts'

const SCRIBE_LIVE_PATH = '/live/scribe'
const SCRIBE_LIVE_ENDPOINT = 'wss://api.zoom.us/v2/aiservices/scribe/live'

export function attachScribeLiveRelay(server: Server) {
    // noServer: route the upgrade ourselves so only the Scribe live path is proxied.
    const wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (req, socket, head) => {
        const { pathname } = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
        if (pathname === SCRIBE_LIVE_PATH) {
            wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client))
        } else {
            socket.destroy()
        }
    })

    wss.on('connection', (client) => {
        const upstream = new WebSocket(SCRIBE_LIVE_ENDPOINT, ['live-asr'], {
            headers: { Authorization: `Bearer ${generateJWT()}` },
        })
        const queue: Array<[unknown, boolean]> = [] // buffer client frames until upstream opens

        upstream.on('open', () => {
            if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'relay.ready' }))
            for (const [data, isBinary] of queue) upstream.send(data as Buffer, { binary: isBinary })
            queue.length = 0
        })
        upstream.on('message', (data, isBinary) => {
            if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary })
        })
        upstream.on('close', () => {
            if (client.readyState === WebSocket.OPEN) client.close(1000)
        })

        const fail = (message: string, code = 1011) => {
            console.error('[live]', message)
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'error', error: { message } }))
                client.close(code)
            }
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
                            : `Zoom returned HTTP ${status} on the live-ASR handshake.`
            fail(hint)
            res.resume() // drain so the socket can be freed
        })

        upstream.on('error', (err) => fail(`Live connection error: ${err.message}`))

        client.on('message', (data, isBinary) => {
            if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary })
            else if (upstream.readyState === WebSocket.CONNECTING) queue.push([data, isBinary])
        })
        client.on('close', () => {
            try {
                upstream.close(1000)
            } catch {
                // ignore
            }
        })
        client.on('error', () => {
            try {
                upstream.close()
            } catch {
                // ignore
            }
        })
    })

    return wss
}
