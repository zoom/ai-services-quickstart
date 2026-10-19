import type { Request, Response, RequestHandler } from 'express'
import multer from 'multer'
import { Readable } from 'node:stream'
import { zoomFetch } from '../util.ts'
import { apiResponseError } from '../apiErrors.ts'
import { speechUploadPolicy } from '../config/uploads.ts'

const upload = multer({ limits: { fileSize: speechUploadPolicy.maxBytes } }).single('file')
export const speechSummarizationUpload: RequestHandler = (req, res, next) => {
    upload(req, res, error => {
        if (!error) { next(); return }
        const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Recording exceeds the 50 MB upload limit.' : error.message })
    })
}

// The API reads multipart parts in order, so config must precede the recording.
export function speechSummarizationForm(config: string | undefined, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    const form = new FormData()
    if (config) form.append('config', config)
    form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname)
    return form
}

export async function speechSummarizationHandler(req: Request, res: Response) {
    if (!req.file) { res.status(400).json({ error: 'A file is required' }); return }
    const controller = new AbortController()
    res.on('close', () => controller.abort())
    try {
        const form = speechSummarizationForm(typeof req.body.config === 'string' ? req.body.config : undefined, req.file)
        const upstream = await zoomFetch('/speech-summarization/summarize', {
            method: 'POST', headers: { Accept: 'text/event-stream' }, body: form, signal: controller.signal,
        })
        if (!upstream.ok) {
            const error = await apiResponseError(upstream)
            if (error.retryAfter) res.setHeader('Retry-After', error.retryAfter)
            res.status(upstream.status).json({ error: error.message, status: error.status, request_id: error.requestId, details: error.body })
            return
        }
        if (!upstream.body) { res.status(502).json({ error: 'Upstream response contained no event stream.' }); return }
        res.status(upstream.status)
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        const stream = Readable.fromWeb(upstream.body)
        stream.on('error', error => { if (!controller.signal.aborted) res.destroy(error) })
        res.on('close', () => stream.destroy())
        stream.pipe(res)
    } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        if (!res.headersSent) res.status(502).json({ error: message })
        else res.destroy(error instanceof Error ? error : undefined)
    }
}
