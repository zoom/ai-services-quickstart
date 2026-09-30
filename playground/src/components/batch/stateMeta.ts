export const JOB_STATES = ['QUEUED', 'PROCESSING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELED'] as const

export const STATE_META: Record<string, { color: string; dot: string }> = {
    QUEUED:          { color: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500' },
    PROCESSING:      { color: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500 animate-pulse' },
    SUCCEEDED:       { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    PARTIAL:         { color: 'bg-orange-50 text-orange-700 border-orange-200',   dot: 'bg-orange-500' },
    FAILED:          { color: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-500' },
    CANCELED:        { color: 'bg-gray-50 text-gray-600 border-gray-200',         dot: 'bg-gray-400' },
    FILE_QUEUED:     { color: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500' },
    FILE_PROCESSING: { color: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500 animate-pulse' },
    FILE_SUCCEEDED:  { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    FILE_FAILED:     { color: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-500' },
    FILE_SKIPPED:    { color: 'bg-gray-50 text-gray-600 border-gray-200',         dot: 'bg-gray-400' },
    FILE_CANCELED:   { color: 'bg-gray-50 text-gray-600 border-gray-200',         dot: 'bg-gray-400' },
}
