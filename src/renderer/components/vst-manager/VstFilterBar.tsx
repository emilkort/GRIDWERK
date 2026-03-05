import { useMemo } from 'react'
import { useVstStore } from '@/stores/vst.store'

const categories = ['All', 'Instrument', 'Effect', 'Unknown'] as const

export default function VstFilterBar() {
  const filters = useVstStore((s) => s.filters)
  const plugins = useVstStore((s) => s.plugins)
  const setFilters = useVstStore((s) => s.setFilters)

  const subcategories = useMemo(() => {
    const set = new Set<string>()
    for (const p of plugins) {
      if (p.subcategory) set.add(p.subcategory)
    }
    return ['All', ...Array.from(set).sort()]
  }, [plugins])

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dark"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search plugins..."
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="w-full bg-base border border-border pl-9 pr-4 py-2 text-[11px] text-text placeholder-text-dark focus:outline-none focus:border-border-hover transition-colors uppercase tracking-wider"
        />
      </div>

      {/* Category buttons */}
      <div className="flex items-center gap-1 bg-surface border border-border p-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilters({ category: cat, subcategory: 'All' })}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              filters.category === cat
                ? 'bg-accent text-white'
                : 'text-text-dark hover:text-text hover:bg-elevated'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Subcategory dropdown */}
      {subcategories.length > 1 && (
        <select
          value={filters.subcategory}
          onChange={(e) => setFilters({ subcategory: e.target.value })}
          className="bg-base border border-border px-3 py-2 text-[10px] text-text-secondary focus:outline-none focus:border-border-hover transition-colors uppercase tracking-wider"
        >
          {subcategories.map((sub) => (
            <option key={sub} value={sub}>
              {sub === 'All' ? 'All Types' : sub}
            </option>
          ))}
        </select>
      )}

      {/* Favorites toggle */}
      <button
        onClick={() => setFilters({ favorite: !filters.favorite })}
        className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors border ${
          filters.favorite
            ? 'bg-accent/10 border-accent/30 text-accent'
            : 'bg-base border-border text-text-dark hover:text-text hover:border-border-hover'
        }`}
      >
        <svg
          className={`w-3.5 h-3.5 ${filters.favorite ? 'fill-accent' : ''}`}
          fill={filters.favorite ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
        Favorites
      </button>

      {/* Plugin count */}
      <span className="text-text-dark text-[10px] font-bold ml-auto uppercase tracking-wider">
        {plugins.length} plugin{plugins.length !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
