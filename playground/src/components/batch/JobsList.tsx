import { Card, Spinner } from '../ui'
import { StateBadge } from './StateBadge'
import { canCancelJob } from './formUtils'
import { JOB_STATES } from './stateMeta'
import type { Job } from '../../lib/batchTypes'

interface Props {
    jobs: Job[]
    loadingJobs: boolean
    stateFilter: string
    onStateFilterChange: (v: string) => void
    onRefresh: () => void
    error?: string
    hasPrevious: boolean
    hasNext: boolean
    page: number
    pageSize: number
    onPageSizeChange: (size: number) => void
    onPrevious: () => void
    onNext: () => void
    onAction: (action: 'status' | 'files' | 'cancel', jobId: string) => void
}

export function JobsList({ jobs, loadingJobs, stateFilter, onStateFilterChange, onRefresh, onAction, error, hasPrevious, hasNext, page, pageSize, onPageSizeChange, onPrevious, onNext }: Props) {
    return (
        <Card className="max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-700 tracking-wide">Jobs</h2>
                    {jobs.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{jobs.length}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="px-2 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 focus:outline-none focus:border-zoom-blue/50 cursor-pointer"
                        value={stateFilter}
                        onChange={e => onStateFilterChange(e.target.value)}
                    >
                        <option value="">All states</option>
                        {JOB_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loadingJobs}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        {loadingJobs ? <Spinner /> : '↺'}
                        {loadingJobs ? 'Loading' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && <p role="alert" className="text-xs text-red-600 mb-3">{error}</p>}
            {jobs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <p className="text-sm text-gray-500">No jobs yet. Submit one or click Refresh.</p>
                </div>
            ) : (
                <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200">
                                {['Job ID', 'State', ''].map(h => (
                                    <th key={h} className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider py-2 px-3">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {jobs.map(job => (
                                <tr key={job.job_id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="py-2 px-3 font-mono text-xs text-gray-500 max-w-28 truncate">{job.job_id}</td>
                                    <td className="py-2 px-3"><StateBadge state={job.state} /></td>
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {([
                                                ['status', 'Status'],
                                                ['files', 'Files'],
                                                ['cancel', 'Cancel'],
                                            ] as const).map(([action, label]) => (
                                                <button
                                                    key={action}
                                                    type="button"
                                                    disabled={action === 'cancel' && !canCancelJob(job.state)}
                                                    title={action === 'cancel' && !canCancelJob(job.state) ? 'Only queued or processing jobs can be canceled' : undefined}
                                                    onClick={() => onAction(action, job.job_id)}
                                                    className={[
                                                        'px-2 py-0.5 text-[11px] rounded-md border transition-all disabled:opacity-30 disabled:cursor-not-allowed',
                                                        action === 'cancel'
                                                            ? 'border-red-200 text-red-500 hover:bg-red-50'
                                                            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700',
                                                    ].join(' ')}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="flex items-center justify-between gap-2 mt-4 text-xs text-gray-500">
                <label>Per page <select aria-label="Jobs per page" value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))} className="border rounded px-1 py-1">{[10, 25, 50, 100].map(size => <option key={size}>{size}</option>)}</select></label>
                <span>Page {page}</span>
                <div className="flex gap-2">
                    <button type="button" disabled={!hasPrevious || loadingJobs} onClick={onPrevious} className="disabled:opacity-30">Previous</button>
                    <button type="button" disabled={!hasNext || loadingJobs} onClick={onNext} className="disabled:opacity-30">Next</button>
                </div>
            </div>
        </Card>
    )
}
