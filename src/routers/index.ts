import { router } from '../trpc.ts'
import { scribeRouter } from './scribe.ts'
import { translatorRouter } from './translator.ts'
import { summarizerRouter } from './summarizer.ts'
import { decisionsRouter } from './decisions.ts'

export const appRouter = router({
    translator: translatorRouter,
    scribe: scribeRouter,
    summarizer: summarizerRouter,
    decisions: decisionsRouter,
})

export type AppRouter = typeof appRouter
