import express, { type Request, type RequestHandler, type Response } from 'express'
import { Readable } from 'node:stream'
import { generateJWT, ZOOM_API_BASE_URL } from '../util.ts'
import { TTS_MAX_BYTES, ttsInputSchema } from '../config/tts.ts'

// Parse this route before the general JSON parser so the raw byte limit is enforced.
const parseJson = express.json({ limit: TTS_MAX_BYTES })
export const ttsJson: RequestHandler = (req, res, next) => {
    parseJson(req, res, (error?: { type?: string }) => {
        if (!error) { next(); return }
        const tooLarge = error.type === 'entity.too.large'
        res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Request exceeds 32 KiB.' : 'Malformed JSON request body.' })
    })
}

export async function ttsHandler(req: Request, res: Response) {
    if (!req.is('application/json')) { res.status(415).json({ error: 'Use Content-Type: application/json.' }); return }
    const parsed = ttsInputSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(issue => issue.message).join(' ') }); return }
    const body = JSON.stringify(parsed.data)
    if (Buffer.byteLength(body) > TTS_MAX_BYTES) { res.status(413).json({ error: 'Request exceeds 32 KiB.' }); return }
    const controller = new AbortController()
    res.on('close', () => controller.abort())
    try {
        const upstream = await fetch(`${ZOOM_API_BASE_URL}/aiservices/tts/synthesize`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${generateJWT()}`, 'Content-Type': 'application/json' },
            body, signal: controller.signal,
        })
        for (const header of ['x-zm-trackingid', 'retry-after']) {
            const value = upstream.headers.get(header)
            if (value) res.setHeader(header, value)
        }
        if (!upstream.ok) {
            const raw = await upstream.text()
            let details: unknown = raw
            try { details = JSON.parse(raw) } catch { /* Upstream errors can be plain text. */ }
            res.status(upstream.status).json({ error: `TTS returned HTTP ${upstream.status}.`, details })
            return
        }
        if (!upstream.body || !upstream.headers.get('content-type')?.startsWith('audio/pcm')) {
            await upstream.body?.cancel()
            res.status(502).json({ error: 'TTS returned an invalid audio response.' })
            return
        }
        res.setHeader('Content-Type', upstream.headers.get('content-type')!)
        res.setHeader('Cache-Control', 'no-store')
        const stream = Readable.fromWeb(upstream.body)
        stream.on('error', error => { if (!controller.signal.aborted) res.destroy(error) })
        res.on('close', () => stream.destroy())
        stream.pipe(res)
    } catch (error) {
        if (controller.signal.aborted) return
        if (res.headersSent) res.destroy(error instanceof Error ? error : undefined)
        else res.status(502).json({ error: error instanceof Error ? error.message : String(error) })
    }
}
