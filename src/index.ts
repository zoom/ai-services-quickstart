import cors from 'cors'
import crypto from 'crypto'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { attachScribeLiveRelay } from './live/scribe.ts'
import { appRouter } from './routers/index.ts'

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.options('*', cors())

// Webhook registered before express.json() — raw body needed for HMAC verification
app.post('/webhooks/:product', express.raw({ type: 'application/json' }), handleWebhook)

// Increase limit for base64-encoded audio files sent via tRPC
app.use(express.json({ limit: '150mb' }))

app.use('/trpc', createExpressMiddleware({ router: appRouter }))

// Single-origin deploy: serve the built playground so its relative /trpc and /live
// calls resolve here. Skipped in dev (no build) where Vite serves the SPA and proxies.
const playgroundDist = path.join(process.cwd(), 'playground', 'dist')
if (fs.existsSync(playgroundDist)) {
    app.use(express.static(playgroundDist))
    app.get(/^(?!\/(trpc|webhooks|live)).*/, (_req, res) =>
        res.sendFile(path.join(playgroundDist, 'index.html')))
}

function handleWebhook(req: express.Request, res: express.Response) {
    const rawBody: unknown = req.body
    if (!Buffer.isBuffer(rawBody)) {
        res.status(400).json({ error: 'Expected a JSON request body' })
        return
    }
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
        const signature = req.headers['x-zm-signature']
        const timestamp = req.headers['x-zm-request-timestamp']
        if (typeof signature !== 'string' || typeof timestamp !== 'string') {
            res.status(401).json({ error: 'Missing signature or timestamp header' })
            return
        }
        const digest = crypto.createHmac('sha256', secret)
            .update('v0:').update(timestamp).update(':').update(rawBody).digest('hex')
        const expected = `sha256=${digest}`
        const sigBuf = Buffer.from(signature)
        const expBuf = Buffer.from(expected)
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            console.log(`[webhook] invalid signature`)
            res.status(401).json({ error: 'Invalid signature' })
            return
        }
    }
    let body: { job?: { job_id?: unknown; summary?: unknown }; event_type?: unknown }
    try {
        const parsed: unknown = JSON.parse(rawBody.toString('utf8'))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('Expected a JSON object')
        body = parsed as typeof body
    } catch {
        res.status(400).json({ error: 'Malformed JSON request body' })
        return
    }
    console.log(`[webhook] from: ${req.url}`)
    console.log(`[webhook] job ${body.job?.job_id}: ${body.event_type}`)
    if (body.job?.summary) console.log(`[webhook] summary:`, body.job.summary)
    res.json({ status: 'received' })
}

const server = app.listen(port, () => console.log(`AI Services API listening on port ${port}`))
attachScribeLiveRelay(server)
