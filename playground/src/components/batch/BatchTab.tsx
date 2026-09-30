import { useState } from 'react'
import { BatchModeSelector } from './BatchModeSelector'
import { BatchResultVisual } from './BatchResultVisual'
import { JobsList } from './JobsList'
import { buildBatchSubmitPayload } from './formUtils'
import { useBatchDetailState } from './useBatchDetailState'
import { CredentialsBox } from '../CredentialsBox'
import { JsonResult } from '../JsonResult'
import { CollapsibleCard, Field, SubmitButton } from '../ui'
import { selectCls, inputCls } from '../../lib/constants'
import { isFilesResponse } from '../../lib/batchTypes'
import { trpc, type RouterInputs } from '../../lib/trpc'
import { defaultBatchForm, type BatchFormState, type BatchInputMode, type BatchModeDescription, type BatchOutputLayout } from './formTypes'

export type BatchProduct = 'scribe' | 'summarizer' | 'translator'
export type BatchConfig<P extends BatchProduct> = Required<NonNullable<RouterInputs[P]['batch']['submit']['config']>>

// Full batch-jobs tab (submit form, response panel, jobs list) for any product with a batch router.
export function BatchTab<P extends BatchProduct>({ product, defaultConfig, modeDescriptions, configTitle, renderConfig }: {
    product: P
    defaultConfig: BatchConfig<P>
    modeDescriptions: Record<BatchInputMode, BatchModeDescription>
    configTitle: string
    renderConfig: (config: BatchConfig<P>, onChange: (config: BatchConfig<P>) => void) => React.ReactNode
}) {
    const [form, setForm] = useState<BatchFormState<BatchConfig<P>>>({ ...defaultBatchForm, config: defaultConfig })
    const onUpdate = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
    const [filesJobId, setFilesJobId] = useState<string | null>(null)

    const api = trpc[product].batch
    const utils = trpc.useUtils()
    const batchState = useBatchDetailState(() => { utils[product].batch.list.invalidate() })
    const jobsQuery = api.list.useQuery({ stateFilter: form.stateFilter || undefined })
    const submitMutation = api.submit.useMutation(batchState.submitOptions)
    const statusMutation = api.getStatus.useMutation(batchState.viewOptions)
    const filesMutation = api.getFiles.useMutation(batchState.viewOptions)
    const loadMoreFilesMutation = api.getFiles.useMutation(batchState.loadMoreOptions)
    const cancelMutation = api.cancel.useMutation(batchState.cancelOptions)

    const { detail, moreFilesError } = batchState
    const formId = `${product}-batch-form`
    const detailLoading = submitMutation.isPending
        || statusMutation.isPending
        || filesMutation.isPending
        || cancelMutation.isPending

    const nextCursor = detail && isFilesResponse(detail) ? detail.next_cursor : undefined

    return (
        <div className="lg:grid lg:grid-cols-[5fr_3fr] gap-5">
            <div className="flex flex-col gap-5 min-w-0">
                <form id={formId} onSubmit={e => { e.preventDefault(); submitMutation.mutate(
                    // TS can't match the payload to a generic product's submit input; config is BatchConfig<P>.
                    buildBatchSubmitPayload(form) as RouterInputs[P]['batch']['submit'],
                ) }} className="flex flex-col gap-5">

                    <CollapsibleCard title="Input">
                        <div className="flex flex-col gap-4">
                            <BatchModeSelector
                                value={form.inputMode}
                                descriptions={modeDescriptions}
                                onChange={v => {
                                    onUpdate({ inputMode: v, ...(v !== 'PREFIX' && { outputLayout: 'PREFIX' }) })
                                }}
                            />

                            {form.inputMode !== 'MANIFEST' && (
                                <Field label="S3 URI" hint={form.inputMode === 'SINGLE' ? 's3://bucket/file.ext' : 's3://bucket/prefix/'}>
                                    <input
                                        className={inputCls + ' font-mono text-xs'}
                                        value={form.inputUri}
                                        onChange={e => onUpdate({ inputUri: e.target.value })}
                                        required
                                        placeholder={form.inputMode === 'SINGLE' ? 's3://my-bucket/file.ext' : 's3://my-bucket/prefix/'}
                                    />
                                </Field>
                            )}

                            {form.inputMode === 'PREFIX' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Include Globs" hint="Comma-separated — **/*.wav, **/*.mp3">
                                        <input className={inputCls + ' font-mono text-xs'} value={form.includeGlobs} onChange={e => onUpdate({ includeGlobs: e.target.value })} placeholder="**/*.wav, **/*.mp3" />
                                    </Field>
                                    <Field label="Exclude Globs" hint="Comma-separated — **/tmp/**, *_draft.*">
                                        <input className={inputCls + ' font-mono text-xs'} value={form.excludeGlobs} onChange={e => onUpdate({ excludeGlobs: e.target.value })} placeholder="**/tmp/**, *_draft.*" />
                                    </Field>
                                </div>
                            )}

                            {form.inputMode === 'MANIFEST' && (
                                <Field label="Manifest URIs" hint="One URI per line. Lines starting with # are ignored.">
                                    <textarea
                                        className={inputCls + ' min-h-32 resize-y font-mono text-xs leading-relaxed'}
                                        value={form.manifest}
                                        onChange={e => onUpdate({ manifest: e.target.value })}
                                        required
                                        placeholder={'# Public URLs\nhttps://cdn.example.com/file1\nhttps://cdn.example.com/file2\n\n# Private S3 URIs\ns3://my-bucket/file3'}
                                    />
                                </Field>
                            )}

                            <CredentialsBox
                                title="Input AWS Credentials"
                                fromEnv={form.inputAwsFromEnv}
                                onFromEnvChange={v => onUpdate({ inputAwsFromEnv: v })}
                                keyId={form.inputAwsKeyId} onKeyId={v => onUpdate({ inputAwsKeyId: v })}
                                secret={form.inputAwsSecret} onSecret={v => onUpdate({ inputAwsSecret: v })}
                                session={form.inputAwsSession} onSession={v => onUpdate({ inputAwsSession: v })}
                                envNote={form.inputMode === 'MANIFEST' ? 'Not required if all manifest URLs are public https:// links. Enable to use server env AWS_* variables for private S3 access.' : undefined}
                            />
                        </div>
                    </CollapsibleCard>

                    <CollapsibleCard title="Output — S3">
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Layout" hint="Where output files will be written">
                                    {form.inputMode === 'PREFIX' ? (
                                        <select
                                            className={selectCls}
                                            value={form.outputLayout}
                                            onChange={e => onUpdate({ outputLayout: e.target.value as BatchOutputLayout })}
                                        >
                                            <option value="ADJACENT">ADJACENT — next to input file</option>
                                            <option value="PREFIX">PREFIX — under output URI</option>
                                        </select>
                                    ) : (
                                        <div className={inputCls + ' text-gray-400 select-none'}>PREFIX — under output URI</div>
                                    )}
                                </Field>
                                {(form.outputLayout === 'PREFIX' || form.inputMode !== 'PREFIX') && (
                                    <Field label="S3 URI" hint="Bucket URI for output files">
                                        <input className={inputCls + ' font-mono text-xs'} value={form.outputUri} onChange={e => onUpdate({ outputUri: e.target.value })} placeholder="s3://my-bucket/output/" required />
                                    </Field>
                                )}
                            </div>
                            <CredentialsBox
                                title="Output AWS Credentials"
                                fromEnv={form.outputAwsFromEnv}
                                onFromEnvChange={v => onUpdate({ outputAwsFromEnv: v })}
                                keyId={form.outputAwsKeyId} onKeyId={v => onUpdate({ outputAwsKeyId: v })}
                                secret={form.outputAwsSecret} onSecret={v => onUpdate({ outputAwsSecret: v })}
                                session={form.outputAwsSession} onSession={v => onUpdate({ outputAwsSession: v })}
                            />
                        </div>
                    </CollapsibleCard>

                    <CollapsibleCard title={configTitle} defaultOpen={false}>
                        {renderConfig(form.config, config => onUpdate({ config }))}
                    </CollapsibleCard>

                    <CollapsibleCard title="Metadata & Notifications" defaultOpen={false}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Reference ID" hint="Optional tracking ID attached to this job (max 256 chars)">
                                <input className={inputCls} value={form.referenceId} onChange={e => onUpdate({ referenceId: e.target.value })} placeholder="job-2025-11" />
                            </Field>
                            <div />
                            <Field label="Webhook URL" hint="Receives POST on every state change">
                                <input className={inputCls} value={form.webhookUrl} onChange={e => onUpdate({ webhookUrl: e.target.value })} placeholder="https://example.com/hooks/service" />
                            </Field>
                            <Field label="Webhook Secret" hint="HMAC secret for payload signature verification">
                                <input className={inputCls + ' font-mono'} type="password" value={form.webhookSecret} onChange={e => onUpdate({ webhookSecret: e.target.value })} placeholder="hmac-secret" />
                            </Field>
                        </div>
                    </CollapsibleCard>
                </form>
            </div>

            <div className="flex flex-col gap-5 lg:sticky lg:top-18 min-w-0">
                <SubmitButton form={formId} busy={submitMutation.isPending} label="Submit Batch Job" busyLabel="Submitting…" />

                <JsonResult
                    data={detail}
                    loading={detailLoading}
                    className="max-h-96"
                    visual={detail ? <BatchResultVisual data={detail} /> : undefined}
                    footer={!detailLoading && filesJobId && nextCursor && (
                        <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 shrink-0">
                            {moreFilesError && <p role="alert" className="text-xs text-red-600 mb-2">{moreFilesError}</p>}
                            <button
                                type="button"
                                onClick={() => loadMoreFilesMutation.mutate({ jobId: filesJobId, next_page_token: nextCursor })}
                                disabled={loadMoreFilesMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                {loadMoreFilesMutation.isPending ? '… Loading…' : '↓ Load more files'}
                            </button>
                        </div>
                    )}
                />

                <JobsList
                    jobs={jobsQuery.data?.jobs ?? []}
                    loadingJobs={jobsQuery.isFetching}
                    stateFilter={form.stateFilter}
                    onStateFilterChange={v => onUpdate({ stateFilter: v })}
                    onRefresh={() => jobsQuery.refetch()}
                    onAction={(action, jobId) => {
                        if (action === 'files') {
                            setFilesJobId(jobId)
                            filesMutation.mutate({ jobId })
                        } else if (action === 'status') {
                            statusMutation.mutate({ jobId })
                        } else {
                            cancelMutation.mutate({ jobId })
                        }
                    }}
                />
            </div>
        </div>
    )
}
