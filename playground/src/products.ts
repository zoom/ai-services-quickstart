import type { ComponentType } from 'react'
import { FastTab } from './products/scribe/tabs/FastTab'
import { BatchTab } from './products/scribe/tabs/BatchTab'
import { LiveTab } from './products/scribe/tabs/LiveTab'
import { FastTab as SummarizerFastTab } from './products/summarizer/tabs/FastTab'
import { BatchTab as SummarizerBatchTab } from './products/summarizer/tabs/BatchTab'
import { FastTab as TranslatorFastTab } from './products/translator/tabs/FastTab'
import { BatchTab as TranslatorBatchTab } from './products/translator/tabs/BatchTab'
import { LiveTab as VoiceAgentLiveTab } from './products/voice-agent/tabs/LiveTab'
import { SummarizeTab as SpeechSummarizationTab } from './products/speech-summarization/tabs/SummarizeTab'
import { GenerateTab as ClinicalNotesGenerateTab } from './products/clinical-notes/tabs/GenerateTab'
import { JobTab as ClinicalNotesJobTab } from './products/clinical-notes/tabs/JobTab'
import { DecideTab as DecisionsTab } from './products/decisions/tabs/DecideTab'

export type ProductTab = {
    id: string
    label: string
    hint: string
    component: ComponentType
}

export type Product = {
    id: string
    label: string
    defaultTab: string
    tabs: ProductTab[]
}

export const PRODUCTS: Product[] = [
    {
        id: 'scribe',
        label: 'Scribe',
        defaultTab: 'fast',
        tabs: [
            { id: 'fast', label: 'Fast', hint: 'Upload & transcribe instantly', component: FastTab },
            { id: 'batch', label: 'Batch', hint: 'Process thousands of files', component: BatchTab },
            { id: 'live', label: 'Live', hint: 'Stream your mic & transcribe in real time', component: LiveTab },
        ],
    },
    {
        id: 'translator',
        label: 'Translator',
        defaultTab: 'fast',
        tabs: [
            { id: 'fast', label: 'Fast', hint: 'Translate text instantly - up to 4,000 characters', component: TranslatorFastTab },
            { id: 'batch', label: 'Batch', hint: 'Translate txt files via S3', component: TranslatorBatchTab },
        ],
    },
    {
        id: 'summarizer',
        label: 'Summarizer',
        defaultTab: 'fast',
        tabs: [
            { id: 'fast', label: 'Fast', hint: 'Summarize transcript text inline - up to 96 KB', component: SummarizerFastTab },
            { id: 'batch', label: 'Batch', hint: 'Summarize transcript files via storage jobs', component: SummarizerBatchTab },
        ],
    },
    {
        id: 'speech-summarization',
        label: 'Speech Summarization',
        defaultTab: 'summarize',
        tabs: [
            { id: 'summarize', label: 'Summarize', hint: 'Transcribe a recording and stream a summary', component: SpeechSummarizationTab },
        ],
    },
    {
        id: 'voice-agent',
        label: 'Voice Agent',
        defaultTab: 'live',
        tabs: [
            { id: 'live', label: 'Live', hint: 'Talk to a voice agent in real time', component: VoiceAgentLiveTab },
        ],
    },
    {
        id: 'clinical-notes',
        label: 'Clinical Notes',
        defaultTab: 'generate',
        tabs: [
            { id: 'generate', label: 'Generate', hint: 'Transcribe a recording and generate a note', component: ClinicalNotesGenerateTab },
            { id: 'jobs', label: 'Jobs', hint: 'Submit a recording URL as an asynchronous job', component: ClinicalNotesJobTab },
        ],
    },
    {
        id: 'decisions',
        label: 'Decisions',
        defaultTab: 'decide',
        tabs: [
            { id: 'decide', label: 'Decide', hint: 'Evaluate typed questions against shared input', component: DecisionsTab },
        ],
    },
]
