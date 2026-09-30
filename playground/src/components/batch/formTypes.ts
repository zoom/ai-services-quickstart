export type BatchInputMode = 'SINGLE' | 'PREFIX' | 'MANIFEST'
export type BatchOutputLayout = 'ADJACENT' | 'PREFIX'

export type BatchModeDescription = {
    title: string
    hint: string
}

export type BatchFormState<TConfig> = {
    inputMode: BatchInputMode
    inputUri: string
    manifest: string
    includeGlobs: string
    excludeGlobs: string
    inputAwsFromEnv: boolean
    inputAwsKeyId: string
    inputAwsSecret: string
    inputAwsSession: string
    outputUri: string
    outputLayout: BatchOutputLayout
    outputAwsFromEnv: boolean
    outputAwsKeyId: string
    outputAwsSecret: string
    outputAwsSession: string
    config: TConfig
    referenceId: string
    webhookUrl: string
    webhookSecret: string
    stateFilter: string
}

export const defaultBatchForm: Omit<BatchFormState<never>, 'config'> = {
    inputMode: 'PREFIX',
    inputUri: '',
    manifest: '',
    includeGlobs: '',
    excludeGlobs: '',
    inputAwsFromEnv: true,
    inputAwsKeyId: '',
    inputAwsSecret: '',
    inputAwsSession: '',
    outputUri: '',
    outputLayout: 'ADJACENT',
    outputAwsFromEnv: true,
    outputAwsKeyId: '',
    outputAwsSecret: '',
    outputAwsSession: '',
    referenceId: '',
    webhookUrl: '',
    webhookSecret: '',
    stateFilter: '',
}
