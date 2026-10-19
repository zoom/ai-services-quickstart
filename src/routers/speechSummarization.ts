import type { Request, Response } from 'express'
import multer from 'multer'
import { Readable } from 'node:stream'
import { zoomFetch } from '../util.ts'

// 50 MB is the Speech Summarization upload limit.
export const speechSummarizationUpload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }).single('file')

// Forwards the multipart upload to Zoom and pipes the Server-Sent Events response back unchanged.
export async function speechSummarizationHandler(req: Request, res: Response) {
    if (!req.file) {
        res.status(400).json({ error: 'A file is required' })
        return
    }
    // Send `config` before `file`: the API reads the parts in order.
    const form = new FormData()
    if (typeof req.body.config === 'string') form.append('config', req.body.config)
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname)

    const upstream = await zoomFetch('/speech-summarization/summarize', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
        body: form,
    }).catch((err: Error) => err)

    if (upstream instanceof Error) {
        res.status(502).json({ error: upstream.message })
        return
    }
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'text/event-stream')
    if (!upstream.body) {
        res.end()
        return
    }
    Readable.fromWeb(upstream.body).pipe(res)
}
