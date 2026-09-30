import { formatTime } from '../../../lib/utils'

function RecordingBars({ active }: { active: boolean }) {
    return (
        <div className="flex items-center gap-[3px] h-8">
            {Array.from({ length: 24 }).map((_, i) => (
                <div
                    key={i}
                    className="w-[3px] rounded-full transition-all"
                    style={{
                        backgroundColor: active ? '#0B5CFF' : '#d1d5db',
                        height: active ? undefined : '6px',
                        animation: active
                            ? `barPulse 1.2s ease-in-out ${i * 0.05}s infinite alternate`
                            : 'none',
                    }}
                />
            ))}
        </div>
    )
}

interface Props {
    recording: boolean
    starting: boolean
    recordedBlob: Blob | null
    recordingTime: number
    audioUrl: string | null
    onStart: () => void
    onStop: () => void
    onClear: () => void
}

export function RecordingInterface({ recording, starting, recordedBlob, recordingTime, audioUrl, onStart, onStop, onClear }: Props) {
    return (
        <div className="flex flex-col items-center gap-4 py-6 px-4 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50">
            {!recording && !recordedBlob && (
                <>
                    <RecordingBars active={false} />
                    <p className="text-sm text-gray-500">Click to start recording from your microphone</p>
                    <button
                        type="button"
                        onClick={onStart}
                        disabled={starting}
                        className="group flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white text-sm font-semibold shadow-lg shadow-red-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-wait"
                    >
                        <span className="w-3 h-3 rounded-full bg-white group-hover:scale-110 transition-transform" />
                        {starting ? 'Starting...' : 'Start Recording'}
                    </button>
                </>
            )}

            {recording && (
                <>
                    <RecordingBars active={true} />
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                        </span>
                        <span className="text-lg font-mono font-semibold text-gray-800 tabular-nums tracking-wider">
                            {formatTime(recordingTime)}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onStop}
                        className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gray-800 hover:bg-gray-900 active:scale-95 text-white text-sm font-semibold shadow-lg transition-all duration-150"
                    >
                        <span className="w-3 h-3 rounded-sm bg-white" />
                        Stop Recording
                    </button>
                </>
            )}

            {!recording && recordedBlob && (
                <>
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">Recording ready &middot; {formatTime(recordingTime)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Microphone recording</p>
                    </div>
                    {audioUrl && (
                        <audio src={audioUrl} controls className="w-full rounded-lg h-10" />
                    )}
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                        Discard &amp; re-record
                    </button>
                </>
            )}
        </div>
    )
}
