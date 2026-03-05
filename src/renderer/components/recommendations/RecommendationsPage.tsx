import { useEffect } from 'react'
import { useRecommendationsStore } from '@/stores/recommendations.store'
import VstCard from '@/components/vst-manager/VstCard'
import { useUiStore } from '@/stores/ui.store'

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[11px] font-bold text-text uppercase tracking-[0.15em]">{title}</h2>
      <p className="text-[10px] text-text-dark mt-0.5">{subtitle}</p>
    </div>
  )
}

export default function RecommendationsPage() {
  const { unexploredCategories, trySomethingNew, similarToFavorites, recentlyAdded, loading, fetchRecommendations } =
    useRecommendationsStore()
  const setPage = useUiStore((s) => s.setPage)

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  if (loading && trySomethingNew.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-text-dark text-[11px] uppercase tracking-widest">Loading recommendations...</span>
      </div>
    )
  }

  const hasAny = unexploredCategories.length > 0 || trySomethingNew.length > 0 ||
    similarToFavorites.length > 0 || recentlyAdded.length > 0

  if (!hasAny) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span className="text-text-dark text-[11px] uppercase tracking-widest">No recommendations yet</span>
        <p className="text-text-dark text-[10px]">Add and scan VST plugins to get personalized recommendations</p>
        <button
          onClick={() => setPage('vst-manager')}
          className="mt-2 px-4 py-2 bg-accent text-white text-[10px] font-bold uppercase tracking-widest hover:bg-accent/80 transition-colors"
        >
          Go to VST Manager
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-sm font-bold text-text uppercase tracking-[0.15em]">Discover</h1>
        <p className="text-[11px] text-text-dark mt-1">Smart VST recommendations based on your library</p>
      </div>

      {/* Unexplored Categories */}
      {unexploredCategories.length > 0 && (
        <div>
          <SectionHeader
            title="Unexplored Categories"
            subtitle="Categories you haven't favorited any plugins in yet"
          />
          <div className="flex flex-wrap gap-2">
            {unexploredCategories.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setPage('vst-manager')}
                className="flex items-center gap-2 px-3 py-2 bg-surface border border-border hover:border-border-hover transition-colors group"
              >
                <span className="text-[10px] font-bold text-text uppercase tracking-widest">
                  {cat.category}
                </span>
                <span className="text-[9px] text-text-dark">{cat.count} plugins</span>
                <svg className="w-3 h-3 text-text-dark group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Try Something New */}
      {trySomethingNew.length > 0 && (
        <div>
          <SectionHeader
            title="Try Something New"
            subtitle="Random plugins you haven't explored yet"
          />
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {trySomethingNew.map((plugin) => (
              <VstCard key={plugin.id} plugin={plugin as any} />
            ))}
          </div>
        </div>
      )}

      {/* Similar to Favorites */}
      {similarToFavorites.length > 0 && (
        <div>
          <SectionHeader
            title="Similar to Your Favorites"
            subtitle="Plugins from the same vendors or categories you love"
          />
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {similarToFavorites.map((plugin) => (
              <VstCard key={plugin.id} plugin={plugin as any} />
            ))}
          </div>
        </div>
      )}

      {/* Recently Added */}
      {recentlyAdded.length > 0 && (
        <div>
          <SectionHeader
            title="Recently Added"
            subtitle="Newest plugins in your library"
          />
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {recentlyAdded.map((plugin) => (
              <VstCard key={plugin.id} plugin={plugin as any} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
