export * from '../../../../lib/batchTypes'
import type { AsrConfig } from '../../lib/constants'
import {
    defaultBatchFormStateBase,
    type BaseBatchFormState,
    type BatchInputMode,
    type BatchModeDescription,
    type BatchOutputLayout,
} from '../../../../components/batch/formTypes'

export type InputMode = BatchInputMode
export type OutputLayout = BatchOutputLayout

export type BatchFormState = BaseBatchFormState<AsrConfig, OutputLayout>

export const defaultBatch: BatchFormState = {
    ...defaultBatchFormStateBase,
    config: { language: 'en-US', channel_separation: false, diarization: false },
}

export const MODE_DESCRIPTIONS: Record<InputMode, BatchModeDescription> = {
    SINGLE: { title: 'Single file', hint: 'One S3 audio file' },
    PREFIX: { title: 'S3 directory', hint: 'All files under an S3 prefix' },
    MANIFEST: { title: 'Manifest', hint: 'List of S3 URIs or public URLs' },
}
