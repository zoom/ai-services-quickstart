import { BatchTab as SharedBatchTab } from '../../../components/batch/BatchTab'
import { SummarizerConfigForm } from '../components/SummarizerConfigForm'
import { defaultSummarizerConfig } from '../lib/constants'

const MODE_DESCRIPTIONS = {
    SINGLE: { title: 'Single file', hint: 'One transcript file in storage' },
    PREFIX: { title: 'Prefix', hint: 'All transcript files under a storage prefix' },
    MANIFEST: { title: 'Manifest', hint: 'List of transcript URIs or public URLs' },
}

export function BatchTab() {
    return (
        <SharedBatchTab
            product="summarizer"
            defaultConfig={defaultSummarizerConfig}
            modeDescriptions={MODE_DESCRIPTIONS}
            configTitle="Summarization Config"
            renderConfig={(config, onChange) => <SummarizerConfigForm value={config} onChange={onChange} />}
        />
    )
}
