import { router, procedure } from '../trpc.ts'
import { createApiRequest } from '../util.ts'
import { decisionsInputSchema } from '../decisions/schema.ts'

const makeDecisionsRequest = createApiRequest('decisions')

export const decisionsRouter = router({
    decide: procedure
        .input(decisionsInputSchema)
        // The answer shape depends on each question's type, so the response is returned as-is.
        .mutation(async ({ input }) => (await makeDecisionsRequest('/decide', { json: input })) as Record<string, unknown>),
})
