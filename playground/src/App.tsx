import { Navigate, Route, Routes, useParams, Link } from 'react-router-dom'
import { PRODUCTS } from './products'

function Shell() {
    const { productId, tabId } = useParams()

    const product = PRODUCTS.find(p => p.id === productId) ?? PRODUCTS[0]
    const tab = product.tabs.find(t => t.id === tabId) ?? product.tabs[0]
    const TabComponent = tab.component

    return (
        <div className="min-h-screen bg-zoom-base text-gray-900 antialiased">
            <header className="sticky top-0 z-10">
                <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
                        <div className="flex shrink-0 items-center gap-3">
                            <img src="/logo.svg" alt="Zoom" className="h-5 shrink-0" />
                            <span className="text-sm font-semibold text-gray-400 select-none">/</span>
                            <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">AI Services</span>
                        </div>

                        <nav aria-label="AI services" className="flex min-w-0 items-center gap-1 p-1 overflow-x-auto bg-gray-100 border border-gray-200 rounded-xl">
                            {PRODUCTS.map(p => (
                                <Link
                                    key={p.id}
                                    to={`/${p.id}/${p.defaultTab}`}
                                    className={[
                                        'shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                                        product.id === p.id
                                            ? 'bg-zoom-blue text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-800 hover:bg-white/70',
                                    ].join(' ')}
                                >
                                    {p.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                {product.tabs.length > 1 && (
                    <div className="bg-white border-b border-gray-200">
                        <div className="max-w-7xl mx-auto px-5 flex items-end gap-1">
                            {product.tabs.map(t => (
                                <Link
                                    key={t.id}
                                    to={`/${product.id}/${t.id}`}
                                    title={t.hint}
                                    className={[
                                        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-150 whitespace-nowrap',
                                        tab.id === t.id
                                            ? 'border-zoom-blue text-zoom-blue'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                    ].join(' ')}
                                >
                                    {t.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            <main className="max-w-7xl mx-auto px-5 py-6">
                <TabComponent />
            </main>
        </div>
    )
}

export default function App() {
    const defaultProduct = PRODUCTS[0]
    return (
        <Routes>
            <Route path="/" element={<Navigate to={`/${defaultProduct.id}/${defaultProduct.defaultTab}`} replace />} />
            <Route path="/:productId/:tabId" element={<Shell />} />
            <Route path="/:productId" element={<Shell />} />
            <Route path="*" element={<Navigate to={`/${defaultProduct.id}/${defaultProduct.defaultTab}`} replace />} />
        </Routes>
    )
}
