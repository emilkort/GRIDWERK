import { memo, useState } from 'react'
import type { VstPlugin } from '@/stores/vst.store'
import { useVstStore } from '@/stores/vst.store'

interface VstCardProps {
  plugin: VstPlugin
}

const CATEGORY_ICONS: Record<string, string> = {
  Instrument: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
  Effect: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75'
}

export default memo(function VstCard({ plugin }: VstCardProps) {
  const toggleFavorite = useVstStore((s) => s.toggleFavorite)
  const [showTooltip, setShowTooltip] = useState(false)
  const [imgError, setImgError] = useState(false)

  const isFavorite = plugin.is_favorite === 1

  const formatColor =
    plugin.format === 'VST3'
      ? 'bg-accent/20 text-accent'
      : 'bg-accent-blue/20 text-accent-blue'

  const subcategoryColor = 'bg-emerald-400/15 text-emerald-400'

  return (
    <div
      className="relative bg-surface border border-border p-5 transition-all duration-200 hover:border-border-hover group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Favorite button */}
      <button
        onClick={() => toggleFavorite(plugin.id)}
        className="absolute top-3 right-3 p-1 transition-colors hover:bg-elevated z-[1]"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        {isFavorite ? (
          <svg className="w-4 h-4 text-accent fill-accent" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-text-dark group-hover:text-text-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        )}
      </button>

      {/* Plugin thumbnail or category icon */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
          {plugin.icon_url && !imgError ? (
            <img
              src={plugin.icon_url}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <svg
              className="w-6 h-6 text-text-dark"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={CATEGORY_ICONS[plugin.category || ''] || CATEGORY_ICONS.Effect}
              />
            </svg>
          )}
        </div>
        <h3 className="text-text font-bold text-[13px] truncate pr-6 tracking-[0.04em] uppercase">
          {plugin.plugin_name}
        </h3>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 ${formatColor}`}>
          {plugin.format}
        </span>
        {plugin.subcategory && (
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 ${subcategoryColor}`}>
            {plugin.subcategory}
          </span>
        )}
      </div>

      {/* Vendor */}
      {plugin.vendor && (
        <p className="text-text-muted text-[11px] truncate mb-1.5">{plugin.vendor}</p>
      )}

      {/* Category */}
      <p className="text-text-dark text-[10px] uppercase tracking-widest truncate font-bold">
        {plugin.category || 'Unknown'}
      </p>

      {/* Hover tooltip with file path + description */}
      {showTooltip && (
        <div className="absolute left-0 right-0 -bottom-2 translate-y-full z-10 px-2">
          <div className="bg-surface border border-border px-4 py-3 shadow-2xl shadow-black/90 space-y-1.5">
            {plugin.description && (
              <p className="text-text-secondary text-[11px] leading-relaxed line-clamp-3">
                {plugin.description}
              </p>
            )}
            <p className="text-text-dark text-[10px] break-all leading-relaxed font-mono">
              {plugin.file_path}
            </p>
          </div>
        </div>
      )}
    </div>
  )
})
