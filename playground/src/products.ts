import type { ComponentType } from 'react'
import { FastTab } from './products/scribe/tabs/FastTab'
import { BatchTab } from './products/scribe/tabs/BatchTab'
import { LiveTab } from './products/scribe/tabs/LiveTab'
import { FastTab as SummarizerFastTab } from './products/summarizer/tabs/FastTab'
import { BatchTab as SummarizerBatchTab } from './products/summarizer/tabs/BatchTab'
import { FastTab as TranslatorFastTab } from './products/translator/tabs/FastTab'
import { BatchTab as TranslatorBatchTab } from './products/translator/tabs/BatchTab'

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
]
