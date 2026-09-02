import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { attachScribeLiveRelay } from './live/scribe.ts'
import { appRouter } from './routers/index.ts'
dotenv.config()

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.options('*', cors())

// Webhook registered before express.json() — raw body needed for HMAC verification
app.post('/webhooks/translator', express.raw({ type: 'application/json' }), handleWebhook)
app.post('/webhooks/scribe', express.raw({ type: 'application/json' }), handleWebhook)
app.post('/webhooks/summarizer', express.raw({ type: 'application/json' }), handleWebhook)

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
    const rawBody = req.body as Buffer
    const rawStr = rawBody.toString('utf8')
    const body = JSON.parse(rawStr)
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
        const signature = req.headers['x-zm-signature'] as string
        const timestamp = req.headers['x-zm-request-timestamp'] as string
        if (!signature || !timestamp) { res.status(401).json({ error: 'Missing signature or timestamp header' }); return }
        const message = `v0:${timestamp}:${rawStr}`
        const expected = `sha256=${crypto.createHmac('sha256', secret).update(message).digest('hex')}`
        const sigBuf = Buffer.from(signature)
        const expBuf = Buffer.from(expected)
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            console.log(`[webhook] invalid signature`)
            res.status(401).json({ error: 'Invalid signature' }); return
        }
    }
    console.log(`[webhook] from: ${req.url}`)
    console.log(`[webhook] job ${body.job?.job_id}: ${body.event_type}`)
    if (body.job?.summary) console.log(`[webhook] summary:`, body.job.summary)
    res.json({ status: 'received' })
}

const server = app.listen(port, () => console.log(`AI Services API listening on port ${port}`))
attachScribeLiveRelay(server)
