import { router } from '../trpc.ts'
import { scribeRouter } from './scribe.ts'
import { translatorRouter } from './translator.ts'
import { summarizerRouter } from './summarizer.ts'
import { decisionsRouter } from './decisions.ts'
import { clinicalNotesRouter } from './clinicalNotes.ts'

export const appRouter = router({
    translator: translatorRouter,
    scribe: scribeRouter,
    summarizer: summarizerRouter,
    decisions: decisionsRouter,
    clinicalNotes: clinicalNotesRouter,
})

export type AppRouter = typeof appRouter
