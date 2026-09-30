import { BatchTab as SharedBatchTab } from '../../../components/batch/BatchTab'
import { TranslatorConfigForm } from '../components/TranslatorConfigForm'
import { defaultTranslatorConfig } from '../lib/constants'

const MODE_DESCRIPTIONS = {
    SINGLE: { title: 'Single file', hint: 'One S3 .txt file' },
    PREFIX: { title: 'S3 directory', hint: 'All .txt files under a prefix' },
    MANIFEST: { title: 'Manifest', hint: 'List of S3 URIs or public URLs' },
}

export function BatchTab() {
    return (
        <SharedBatchTab
            product="translator"
            defaultConfig={defaultTranslatorConfig}
            modeDescriptions={MODE_DESCRIPTIONS}
            configTitle="Translator Config"
            renderConfig={(config, onChange) => <TranslatorConfigForm value={config} onChange={onChange} />}
        />
    )
}
