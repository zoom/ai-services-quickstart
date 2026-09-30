import type { BatchFormState } from './formTypes'

function parseManifestEntries(input: string): string[] | undefined {
    const trimmed = input.trim()
    const entries = trimmed
        ? trimmed.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))
        : undefined

    return entries?.length ? entries : undefined
}

function parseCommaSeparated(input: string): string[] | undefined {
    const parsed = input.split(',').map(s => s.trim()).filter(Boolean)
    return parsed.length > 0 ? parsed : undefined
}

function buildAwsCreds(fromEnv: boolean, keyId: string, secret: string, session: string) {
    if (fromEnv || !keyId) return undefined
    return { access_key_id: keyId, secret_access_key: secret, session_token: session }
}

export function buildBatchSubmitPayload<TConfig>(form: BatchFormState<TConfig>) {
    const manifestList = parseManifestEntries(form.manifest)
    const includeGlobs = parseCommaSeparated(form.includeGlobs)
    const excludeGlobs = parseCommaSeparated(form.excludeGlobs)
    const inputAws = buildAwsCreds(form.inputAwsFromEnv, form.inputAwsKeyId, form.inputAwsSecret, form.inputAwsSession)
    const outputAws = buildAwsCreds(form.outputAwsFromEnv, form.outputAwsKeyId, form.outputAwsSecret, form.outputAwsSession)
    const isHttpInput = form.inputMode === 'MANIFEST'
        ? Boolean(manifestList?.every(uri => uri.startsWith('http')))
        : form.inputUri.trim().startsWith('http')
    const inputUri = form.inputUri.trim()
    const outputUri = form.outputUri.trim()
    const usesOutputUri = form.inputMode !== 'PREFIX' || form.outputLayout === 'PREFIX'

    return {
        input: {
            ...(!isHttpInput && { source: 'S3' }),
            mode: form.inputMode,
            ...(form.inputMode !== 'MANIFEST' && inputUri && { uri: inputUri }),
            ...(form.inputMode === 'MANIFEST' && manifestList && { manifest: manifestList }),
            ...(form.inputMode === 'PREFIX' && (includeGlobs || excludeGlobs) && {
                filters: {
                    ...(includeGlobs && { include_globs: includeGlobs }),
                    ...(excludeGlobs && { exclude_globs: excludeGlobs }),
                },
            }),
            ...(inputAws && { auth: { aws: inputAws } }),
        },
        output: {
            destination: 'S3',
            ...(usesOutputUri && outputUri && { uri: outputUri }),
            layout: form.inputMode === 'PREFIX' ? form.outputLayout : 'PREFIX',
            overwrite: false,
            ...(outputAws && { auth: { aws: outputAws } }),
        },
        config: form.config,
        ...(form.referenceId && { reference_id: form.referenceId }),
        ...(form.webhookUrl && {
            notifications: {
                webhook_url: form.webhookUrl,
                ...(form.webhookSecret && { secret: form.webhookSecret }),
            },
        }),
    }
}
