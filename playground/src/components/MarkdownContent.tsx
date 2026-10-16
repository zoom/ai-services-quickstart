import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownContent({ children }: { children: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({ children }) => <h1 className="text-base font-semibold text-gray-900 mb-2">{children}</h1>,
                h2: ({ children, id }) => (
                    <h2 className={id === 'footnote-label' ? 'sr-only' : 'text-sm font-semibold text-gray-800 mb-1.5'} id={id}>{children}</h2>
                ),
                h3: ({ children }) => <h3 className="text-sm font-medium text-gray-700 mb-1">{children}</h3>,
                p: ({ children }) => <p className="text-sm text-gray-800 leading-relaxed mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5 text-sm text-gray-800">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5 text-sm text-gray-800">{children}</ol>,
                li: ({ children, id }) => <li id={id} className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => <code className="text-xs font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">{children}</code>,
                blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-gray-300 pl-3 text-sm text-gray-600 italic mb-2">{children}</blockquote>
                ),
                // Back-links ("↩") are clutter in a read-only view.
                a: ({ children, node, ...props }) =>
                    'dataFootnoteBackref' in (node?.properties ?? {}) ? null : <a className="text-blue-600 hover:underline" {...props}>{children}</a>,
                sup: ({ children }) => <sup className="text-[10px] ml-0.5">{children}</sup>,
                table: ({ children }) => <table className="text-sm border-collapse mb-2">{children}</table>,
                th: ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left font-medium">{children}</th>,
                td: ({ children }) => <td className="border border-gray-200 px-2 py-1">{children}</td>,
                hr: () => <hr className="border-gray-200 my-2" />,
            }}
        >
            {children}
        </ReactMarkdown>
    )
}
