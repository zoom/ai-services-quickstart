import { Navigate, Route, Routes, useParams, Link } from 'react-router-dom'
import { PRODUCTS } from './products'

function Shell() {
    const { productId, tabId } = useParams()

    const product = PRODUCTS.find(p => p.id === productId) ?? PRODUCTS[0]
    const tab = product.tabs.find(t => t.id === tabId) ?? product.tabs[0]
    const TabComponent = tab.component

    return (
        <div className="min-h-screen bg-zoom-base text-gray-900 antialiased">
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-5 pt-4 pb-2 flex items-center">
                    <Link to="/" className="flex items-center gap-3">
                        <img src="/logo.svg" alt="Zoom" className="h-5 shrink-0" />
                        <span className="h-5 w-px bg-gray-300" />
                        <span className="text-[15px] font-semibold tracking-tight text-gray-900 whitespace-nowrap">AI Services</span>
                    </Link>
                </div>

                <div className="border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-5 h-12 flex items-stretch">
                        <nav aria-label="AI services" className="-mx-3 flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto [scrollbar-width:none]">
                            {PRODUCTS.map(p => (
                                <Link
                                    key={p.id}
                                    to={`/${p.id}/${p.defaultTab}`}
                                    aria-current={product.id === p.id ? 'page' : undefined}
                                    className={[
                                        'group relative shrink-0 flex items-center whitespace-nowrap text-sm font-medium transition-colors duration-150 focus-visible:outline-none',
                                        'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-t-full after:transition-colors',
                                        product.id === p.id
                                            ? 'text-zoom-blue after:bg-zoom-blue'
                                            : 'text-gray-600 hover:text-gray-900 after:bg-transparent',
                                    ].join(' ')}
                                >
                                    <span className={[
                                        'px-3 py-1.5 rounded-lg transition-colors group-focus-visible:ring-2 group-focus-visible:ring-zoom-blue/40',
                                        product.id === p.id ? '' : 'group-hover:bg-gray-100',
                                    ].join(' ')}>{p.label}</span>
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                <div className="bg-gray-50/70">
                    <div className="max-w-7xl mx-auto px-5 h-12 flex items-center gap-4">
                        {product.tabs.length > 1 && (
                            <div role="tablist" className="flex items-center gap-0.5 p-1 rounded-lg bg-gray-200/70">
                                {product.tabs.map(t => (
                                    <Link
                                        key={t.id}
                                        role="tab"
                                        aria-selected={tab.id === t.id}
                                        to={`/${product.id}/${t.id}`}
                                        title={t.hint}
                                        className={[
                                            'px-4 py-1 rounded-md text-sm font-medium transition-all duration-150 whitespace-nowrap',
                                            tab.id === t.id
                                                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60',
                                        ].join(' ')}
                                    >
                                        {t.label}
                                    </Link>
                                ))}
                            </div>
                        )}
                        <p className="truncate text-sm text-gray-500">{tab.hint}</p>
                    </div>
                </div>
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
