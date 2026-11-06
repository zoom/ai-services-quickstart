import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decisionsInputSchema } from '../src/decisions/schema.ts'
import { choiceValueKey } from '../src/decisions/schema.ts'

const predicate = { type: 'predicate', name: 'is_alpha', instructions: 'Is the input alpha?' }
const choice = { type: 'choice', name: 'route', instructions: 'Choose a route.', choices: [{ value: 'support' }, { value: 'billing' }] }
const score = { type: 'score', name: 'severity', instructions: 'Rate severity.', levels: [{ label: 'Low' }, { label: 'High' }] }
const request = (question: unknown = predicate) => ({ input: 'Category alpha.', questions: [question] })
const structured = (content: unknown[]) => ({ ...request(), input: [{ role: 'user', content }] })
const image = { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' }

// Dummy credentials satisfy module initialization; every router test mocks fetch.
process.env.ZOOM_API_KEY = 'offline-test-key'
process.env.ZOOM_API_SECRET = 'offline-test-secret'
const { decisionsRouter } = await import('../src/routers/decisions.ts')
const { ZOOM_API_BASE_URL } = await import('../src/util.ts')
const caller = decisionsRouter.createCaller({})

const invalidRequests: Array<[string, unknown]> = [
    ...[predicate, choice, score].flatMap(question => [
        [`${question.type}: omitted name`, request({ ...question, name: undefined })],
        [`${question.type}: empty name`, request({ ...question, name: '' })],
        [`${question.type}: whitespace name`, request({ ...question, name: ' \t\n ' })],
        [`${question.type}: empty instructions`, request({ ...question, instructions: '' })],
        [`${question.type}: whitespace instructions`, request({ ...question, instructions: ' \t ' })],
    ] as Array<[string, unknown]>),
    ['duplicate names across types', { ...request(), questions: [predicate, { ...choice, name: predicate.name }] }],
    ['duplicate names after trimming', { ...request(), questions: [predicate, { ...score, name: ` ${predicate.name} ` }] }],
    ['missing choices', request({ ...choice, choices: undefined })],
    ['empty choices', request({ ...choice, choices: [] })],
    ['single choice', request({ ...choice, choices: [{ value: true }] })],
    ['missing choice value', request({ ...choice, choices: [{}, { value: 'other' }] })],
    ['empty choice value', request({ ...choice, choices: [{ value: '' }, { value: 'other' }] })],
    ['whitespace choice value', request({ ...choice, choices: [{ value: ' \t ' }, { value: 'other' }] })],
    ['duplicate string choices', request({ ...choice, choices: [{ value: 'same' }, { value: 'same' }] })],
    ['duplicate choices after trimming', request({ ...choice, choices: [{ value: 'same' }, { value: ' same ' }] })],
    ['duplicate true choices', request({ ...choice, choices: [{ value: true }, { value: 'true' }] })],
    ['duplicate false choices', request({ ...choice, choices: [{ value: false }, { value: 'false' }] })],
    ['duplicate Boolean choices', request({ ...choice, choices: [{ value: false }, { value: false }] })],
    ['unsupported choice value type', request({ ...choice, choices: [{ value: 1 }, { value: 2 }] })],
    ['missing levels', request({ ...score, levels: undefined })],
    ['empty levels', request({ ...score, levels: [] })],
    ['single level', request({ ...score, levels: [{ label: 'Low' }] })],
    ['missing level label', request({ ...score, levels: [{}, { label: 'High' }] })],
    ['empty level label', request({ ...score, levels: [{ label: '' }, { label: 'High' }] })],
    ['whitespace level label', request({ ...score, levels: [{ label: ' \t ' }, { label: 'High' }] })],
    ['predicate with choices', request({ ...predicate, choices: choice.choices })],
    ['predicate with levels', request({ ...predicate, levels: score.levels })],
    ['choice with levels', request({ ...choice, levels: score.levels })],
    ['score with choices', request({ ...score, choices: choice.choices })],
    ['missing questions', { input: 'Alpha.' }],
    ['empty questions', { ...request(), questions: [] }],
    ['empty text input', { ...request(), input: '' }],
    ['whitespace text input', { ...request(), input: ' \n\t ' }],
    ['empty structured input', { ...request(), input: [] }],
    ['empty structured content', structured([])],
    ['empty structured text', structured([{ type: 'input_text', text: '' }])],
    ['whitespace structured text', structured([{ type: 'input_text', text: ' \n ' }])],
    ['image without enable flag', structured([image])],
    ['image with disabled flag', { ...structured([image]), enable_image_input: false }],
    ['empty image URL', { ...structured([{ ...image, image_url: '' }]), enable_image_input: true }],
    ['whitespace image URL', { ...structured([{ ...image, image_url: ' \t ' }]), enable_image_input: true }],
]

for (const [name, input] of invalidRequests) {
    test(`rejects ${name} before making an API call`, async t => {
        const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
            throw new Error('Invalid input must never reach the API.')
        })
        assert.equal(decisionsInputSchema.safeParse(input).success, false)
        await assert.rejects(caller.decide(input as never), { code: 'BAD_REQUEST' })
        assert.equal(fetchMock.mock.callCount(), 0)
    })
}

test('accepts all question types together, trims names, and preserves evidence', () => {
    const parsed = decisionsInputSchema.parse({
        input: '  Category alpha.\n',
        questions: [predicate, { ...choice, name: ' route ' }, score],
    })
    assert.equal(parsed.questions[1].name, 'route')
    assert.equal(parsed.input, '  Category alpha.\n')
})

test('keeps question and choice validation errors at the offending fields', () => {
    const result = decisionsInputSchema.safeParse({
        ...request(),
        questions: [predicate, { ...choice, name: ' is_alpha ', choices: [{ value: true }, { value: 'true' }] }],
    })
    assert.equal(result.success, false)
    if (!result.success) {
        const paths = result.error.issues.map(issue => issue.path.join('.'))
        assert.ok(paths.includes('questions.1.name'))
        assert.ok(paths.includes('questions.1.choices.1.value'))
    }
})

test('accepts Boolean choices, mixed distinct values, and duplicate score labels', () => {
    for (const values of [[true, false], [true, 'false'], ['true', false], ['True', 'true']]) {
        const parsed = decisionsInputSchema.parse(request({ ...choice, choices: values.map(value => ({ value })) }))
        assert.deepEqual(parsed.questions[0], { ...choice, choices: values.map(value => ({ value })) })
    }
    assert.equal(decisionsInputSchema.safeParse(request({ ...score, levels: [{ label: 'Same' }, { label: 'Same' }] })).success, true)
})

test('accepts structured text and enabled image input, including image-only messages', () => {
    for (const input of [
        structured([{ type: 'input_text', text: '  Alpha.\n' }]),
        { ...structured([image]), enable_image_input: true },
        { ...structured([{ type: 'input_text', text: 'Alpha.' }, image]), enable_image_input: true },
    ]) {
        assert.equal(decisionsInputSchema.safeParse(input).success, true)
    }
})

test('checks every message for empty content and disabled image input', () => {
    const text = { role: 'user', content: [{ type: 'input_text', text: 'Alpha.' }] }
    for (const content of [[], [image], [{ type: 'input_text', text: ' ' }]]) {
        assert.equal(decisionsInputSchema.safeParse({ ...request(), input: [text, { role: 'user', content }] }).success, false)
    }
})

for (const selected of [true, false]) {
    test(`matches Boolean ${selected} to string distribution values and preserves the raw response`, async t => {
        const response = {
            answers: [{ type: 'choice', name: 'truth', choice: selected, probabilities: [
                { value: 'true', probability: selected ? 0.9994 : 0.0006 },
                { value: 'false', probability: selected ? 0.0006 : 0.9994 },
            ] }],
        }
        const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(response))
        const result = await caller.decide(request({
            ...choice, name: ' truth ', choices: [{ value: true }, { value: false }],
        }) as never)
        assert.deepEqual(result, response)
        const [url, init] = fetchMock.mock.calls[0].arguments
        assert.equal(url, `${ZOOM_API_BASE_URL}/aiservices/decisions/decide`)
        const sent = JSON.parse(init?.body as string)
        assert.equal(sent.questions[0].name, 'truth')
        assert.deepEqual(sent.questions[0].choices, [{ value: true }, { value: false }])
        const answer = response.answers[0]
        const winner = answer.probabilities.find(p => choiceValueKey(p.value) === choiceValueKey(answer.choice))
        assert.equal(winner?.value, String(selected))
        assert.equal(winner?.probability, 0.9994)
    })
}

test('normalization preserves text choices and does not coerce unsupported values', () => {
    assert.equal(choiceValueKey('billing'), 'billing')
    assert.equal(choiceValueKey('True'), 'True')
    for (const value of [undefined, null, 0, {}, []]) assert.equal(choiceValueKey(value), undefined)
})
