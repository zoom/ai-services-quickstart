import { BatchTab as SharedBatchTab } from '../../../components/batch/BatchTab'
import { AsrConfigForm } from '../components/AsrConfig'
import { defaultAsrConfig } from '../lib/constants'

const MODE_DESCRIPTIONS = {
    SINGLE: { title: 'Single file', hint: 'One S3 audio file' },
    PREFIX: { title: 'S3 directory', hint: 'All files under an S3 prefix' },
    MANIFEST: { title: 'Manifest', hint: 'List of S3 URIs or public URLs' },
}

export function BatchTab() {
    return (
        <SharedBatchTab
            product="scribe"
            defaultConfig={defaultAsrConfig}
            modeDescriptions={MODE_DESCRIPTIONS}
            configTitle="Transcription Config"
            renderConfig={(config, onChange) => <AsrConfigForm value={config} onChange={onChange} />}
        />
    )
}
