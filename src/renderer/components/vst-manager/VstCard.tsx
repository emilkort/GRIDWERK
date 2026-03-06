import { memo, useState, useEffect, useRef } from 'react'
import type { MergedVstPlugin } from '@/utils/vst-grouping'
import { useVstStore } from '@/stores/vst.store'

interface VstCardProps {
  plugin: MergedVstPlugin
  onClick?: () => void
}

// Badge pill colors per category
const CATEGORY_BADGE: Record<string, string> = {
  Instrument: 'bg-blue-500/15 text-blue-400',
  Effect: 'bg-emerald-500/15 text-emerald-400'
}

// Category tinting applied to ALL cards
const CATEGORY_TINT: Record<string, { border: string; bg: string; icon: string; topLine: string }> = {
  Instrument: {
    border: 'border-l-blue-500/40',
    bg: 'bg-gradient-to-br from-blue-500/[0.04] to-transparent',
    icon: 'text-blue-400/[0.07]',
    topLine: 'bg-blue-500/30'
  },
  Effect: {
    border: 'border-l-emerald-500/40',
    bg: 'bg-gradient-to-br from-emerald-500/[0.04] to-transparent',
    icon: 'text-emerald-400/[0.07]',
    topLine: 'bg-emerald-500/30'
  }
}

const DEFAULT_TINT = {
  border: 'border-l-white/10',
  bg: 'bg-gradient-to-br from-white/[0.02] to-transparent',
  icon: 'text-white/[0.04]',
  topLine: 'bg-white/10'
}

// Decorative SVG paths per category (used as watermark in no-image cards)
const CATEGORY_SVG: Record<string, string> = {
  Instrument:
    'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
  Effect:
    'M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75'
}

const DEFAULT_SVG =
  'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5'

export default memo(function VstCard({ plugin, onClick }: VstCardProps) {
  const toggleFavorite = useVstStore((s) => s.toggleFavorite)
  const hidePlugin = useVstStore((s) => s.hidePlugin)
  const [imgError, setImgError] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!ctxMenu) return
    const close = (e: Event) => {
      // Don't close if clicking inside the context menu itself
      if (ctxRef.current && ctxRef.current.contains(e.target as Node)) return
      setCtxMenu(null)
    }
    // Use mousedown so menu items' onClick still fires before close
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('contextmenu', close)
    }
  }, [ctxMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const menuW = 180
    const menuH = 160
    const x = Math.min(e.clientX, window.innerWidth - menuW)
    const y = Math.min(e.clientY, window.innerHeight - menuH)
    setCtxMenu({ x, y })
  }

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCtxMenu(null)
    hidePlugin(plugin.pluginIds)
  }

  const isFavorite = plugin.is_favorite === 1
  const hasImage = plugin.icon_url && !imgError && !plugin.icon_url.startsWith('data:')
  const badgeColor = CATEGORY_BADGE[plugin.category || ''] || 'bg-white/5 text-text-dark'
  const tint = CATEGORY_TINT[plugin.category || ''] || DEFAULT_TINT
  const watermarkPath = CATEGORY_SVG[plugin.category || ''] || DEFAULT_SVG

  const handleToggleFavorite = () => {
    for (const pid of plugin.pluginIds) {
      toggleFavorite(pid)
    }
  }

  const handleWebsiteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (plugin.website) {
      window.open(plugin.website, '_blank')
    }
  }

  const favoriteBtn = (
    <button
      onClick={handleToggleFavorite}
      className={`p-1 transition-colors ${
        hasImage ? 'bg-black/40 backdrop-blur-sm hover:bg-black/60' : 'hover:bg-white/5'
      }`}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        className={`w-3.5 h-3.5 ${isFavorite ? 'text-accent fill-accent' : 'text-text-dark hover:text-text'}`}
        fill={isFavorite ? 'currentColor' : 'none'}
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
    </button>
  )

  const formatBadges = (
    <div className="flex items-center gap-1">
      {plugin.formats.sort().map((fmt) => (
        <span
          key={fmt}
          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 ${
            hasImage ? 'backdrop-blur-sm' : ''
          } ${
            fmt === 'VST3' ? 'bg-accent/20 text-accent' : 'bg-accent-blue/20 text-accent-blue'
          }`}
        >
          {fmt}
        </span>
      ))}
    </div>
  )

  const contextMenu = ctxMenu && (
    <div
      ref={ctxRef}
      className="fixed z-[9999] bg-elevated border border-border shadow-xl py-1 min-w-[160px]"
      style={{ left: ctxMenu.x, top: ctxMenu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); setCtxMenu(null) }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-text hover:bg-white/5 uppercase tracking-wider"
      >
        <svg className="w-3.5 h-3.5" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
        {isFavorite ? 'Unfavorite' : 'Favorite'}
      </button>
      {plugin.website && (
        <button
          onClick={(e) => { e.stopPropagation(); window.open(plugin.website!, '_blank'); setCtxMenu(null) }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-text hover:bg-white/5 uppercase tracking-wider"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Open Website
        </button>
      )}
      {plugin.filePaths.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); window.api.shell.showInFolder(plugin.filePaths[0].path); setCtxMenu(null) }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-text hover:bg-white/5 uppercase tracking-wider"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          Show in Explorer
        </button>
      )}
      <div className="h-px bg-border my-1" />
      <button
        onClick={handleHide}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-accent hover:bg-accent/10 uppercase tracking-wider"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
        Hide Plugin
      </button>
    </div>
  )

  // ── Card WITH image ──
  if (hasImage) {
    return (
      <div onClick={onClick} onContextMenu={handleContextMenu} className="relative bg-surface border border-border transition-all duration-200 hover:border-border-hover group flex flex-col overflow-hidden cursor-pointer">
        {contextMenu}
        {/* Category color line at top */}
        <div className={`h-[2px] w-full ${tint.topLine} shrink-0`} />

        {/* Image banner */}
        <div className="w-full h-24 bg-elevated border-b border-border flex items-center justify-center overflow-hidden relative">
          <img
            src={plugin.icon_url!}
            alt=""
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
          <div className="absolute top-2 right-2">{favoriteBtn}</div>
          <div className="absolute top-2 left-2">{formatBadges}</div>
        </div>

        {/* Content with subtle category wash */}
        <div className="relative p-4 flex-1 flex flex-col gap-2">
          <div className={`absolute inset-0 ${tint.bg} pointer-events-none`} />
          <h3 className="relative text-text font-bold text-[13px] truncate tracking-[0.04em] uppercase leading-tight">
            {plugin.plugin_name}
          </h3>
          <div className="relative flex flex-wrap items-center gap-1.5">
            <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 ${badgeColor}`}>
              {plugin.category || 'Unknown'}
            </span>
            {plugin.subcategory && (
              <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 bg-white/5 text-text-secondary">
                {plugin.subcategory}
              </span>
            )}
          </div>
          {plugin.description && (
            <p className="relative text-text-dark text-[10px] leading-relaxed line-clamp-2 mt-auto">
              {plugin.description}
            </p>
          )}
          {plugin.website && (
            <button
              onClick={handleWebsiteClick}
              className="relative flex items-center gap-1 text-[10px] text-text-dark hover:text-accent transition-colors mt-auto self-start"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Website
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Card WITHOUT image — fill full height with content ──
  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`relative bg-elevated border border-border border-l-2 ${tint.border} transition-all duration-200 hover:border-border-hover group flex flex-col h-full overflow-hidden cursor-pointer`}
    >
      {contextMenu}
      {/* Category color line at top */}
      <div className={`h-[2px] w-full ${tint.topLine} shrink-0`} />
      {/* Subtle category gradient wash */}
      <div className={`absolute inset-0 ${tint.bg} pointer-events-none`} />

      {/* Decorative watermark icon — bottom-right */}
      <svg
        className={`absolute -bottom-3 -right-3 w-24 h-24 ${tint.icon} pointer-events-none`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={0.75}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={watermarkPath} />
      </svg>

      {/* Top bar: format badges + favorite */}
      <div className="relative flex items-center justify-between px-4 pt-4">
        {formatBadges}
        {favoriteBtn}
      </div>

      {/* Content — uses full card height */}
      <div className="relative px-4 pb-4 pt-3 flex-1 flex flex-col">
        {/* Large plugin name */}
        <h3 className="text-text font-bold text-lg tracking-[0.05em] uppercase leading-tight line-clamp-2">
          {plugin.plugin_name}
        </h3>

        {/* Vendor */}
        {plugin.vendor && (
          <p className="text-text-secondary text-[11px] tracking-wider uppercase mt-1.5">
            {plugin.vendor}
          </p>
        )}

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 ${badgeColor}`}>
            {plugin.category || 'Unknown'}
          </span>
          {plugin.subcategory && (
            <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 bg-white/5 text-text-secondary">
              {plugin.subcategory}
            </span>
          )}
        </div>

        {/* Description — generous room without the image banner */}
        {plugin.description && (
          <p className="text-text-dark text-[10px] leading-relaxed line-clamp-5 mt-3">
            {plugin.description}
          </p>
        )}

        {/* Spacer pushes footer to bottom */}
        <div className="flex-1" />

        {/* Website link pinned to bottom */}
        {plugin.website && (
          <button
            onClick={handleWebsiteClick}
            className="flex items-center gap-1 text-[10px] text-text-dark hover:text-accent transition-colors self-start mt-3"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Website
          </button>
        )}
      </div>
    </div>
  )
})
