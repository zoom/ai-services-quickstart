import { router } from '../trpc.ts'
import { scribeRouter } from './scribe.ts'
import { translatorRouter } from './translator.ts'
import { summarizerRouter } from './summarizer.ts'

export const appRouter = router({
    translator: translatorRouter,
    scribe: scribeRouter,
    summarizer: summarizerRouter,
})

export type AppRouter = typeof appRouter
