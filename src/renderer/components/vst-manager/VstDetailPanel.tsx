import { useCallback, useState } from 'react'
import type { MergedVstPlugin } from '@/utils/vst-grouping'
import { useVstStore } from '@/stores/vst.store'
import TagPicker from '@/components/tags/TagPicker'

interface VstDetailPanelProps {
  plugin: MergedVstPlugin | null
  onClose: () => void
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const CATEGORY_ACCENT: Record<string, string> = {
  Instrument: '#3b82f6',
  Effect: '#10b981'
}

export default function VstDetailPanel({ plugin, onClose }: VstDetailPanelProps) {
  const [enriching, setEnriching] = useState(false)
  const enrichSingle = useVstStore((s) => s.enrichSingle)
  const toggleFavorite = useVstStore((s) => s.toggleFavorite)
  const fetchPlugins = useVstStore((s) => s.fetchPlugins)

  const handleEnrich = useCallback(async () => {
    if (!plugin || enriching) return
    setEnriching(true)
    try {
      // Enrich all underlying plugin IDs
      for (const pid of plugin.pluginIds) {
        await enrichSingle(pid)
      }
      await fetchPlugins()
    } catch (err) {
      console.error('Enrich failed:', err)
    } finally {
      setEnriching(false)
    }
  }, [plugin, enriching, enrichSingle, fetchPlugins])

  const handleShowInFolder = useCallback(
    (filePath: string) => {
      window.api.shell.showInFolder(filePath)
    },
    []
  )

  const handleToggleFavorite = useCallback(() => {
    if (!plugin) return
    for (const pid of plugin.pluginIds) {
      toggleFavorite(pid)
    }
  }, [plugin, toggleFavorite])

  // ── Empty state ──
  if (!plugin) {
    return (
      <div className="w-80 border-l border-border bg-surface flex flex-col items-center justify-center text-center px-6 z-10">
        <div className="w-16 h-16 bg-base border border-border flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
        <p className="text-text text-[12px] font-bold tracking-[0.1em] uppercase mb-1.5">No Plugin Selected</p>
        <p className="text-text-muted text-[11px] tracking-wider">Click a plugin to view its details</p>
      </div>
    )
  }

  const isFav = plugin.is_favorite === 1
  const isEnriched = plugin.enriched === 1
  const accent = CATEGORY_ACCENT[plugin.category || ''] || '#888'
  const hasImage = plugin.icon_url && !plugin.icon_url.startsWith('data:')
  const totalSize = plugin.filePaths.reduce((sum, f) => sum + (f.size || 0), 0)

  return (
    <div className="w-80 h-full border-l border-border bg-surface flex flex-col overflow-hidden z-10">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border shrink-0 bg-base">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-text text-[13px] font-bold truncate tracking-[0.04em] uppercase">
              {plugin.plugin_name}
            </h2>
            {plugin.vendor && (
              <p className="text-text-secondary text-[11px] truncate mt-1 tracking-wider uppercase">
                {plugin.vendor}
              </p>
            )}
          </div>
          {/* Favorite toggle */}
          <button
            onClick={handleToggleFavorite}
            className={`flex-shrink-0 mt-0.5 transition-all duration-150 ${
              isFav ? 'text-accent' : 'text-text-muted hover:text-accent'
            }`}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg className="w-5 h-5" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </button>
          {/* Close button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 mt-0.5 text-text-muted hover:text-text transition-colors"
            title="Close panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Plugin image */}
      {hasImage && (
        <div className="w-full h-32 bg-elevated border-b border-border flex items-center justify-center overflow-hidden">
          <img src={plugin.icon_url!} alt="" className="w-full h-full object-contain" />
        </div>
      )}

      {/* Enrich button */}
      <div className="px-6 py-4 border-b border-border">
        <button
          onClick={handleEnrich}
          disabled={enriching}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${
            isEnriched
              ? 'bg-elevated text-text-muted hover:text-text border border-border'
              : 'bg-accent hover:bg-red-600 text-white'
          } disabled:opacity-50`}
        >
          {enriching ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
              Enriching...
            </>
          ) : isEnriched ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-enrich
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Enrich Metadata
            </>
          )}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Metadata grid */}
        <div>
          <h3 className="text-text-dark text-[10px] font-bold uppercase tracking-[0.15em] mb-3">Metadata</h3>
          <div className="grid grid-cols-2 gap-3">
            <MetaItem label="Category" value={plugin.category || 'Unknown'} accent={accent} />
            <MetaItem label="Type" value={plugin.subcategory || '--'} />
            <MetaItem label="Formats" value={plugin.formats.sort().join(' + ')} />
            <MetaItem label="Total Size" value={formatFileSize(totalSize || null)} />
            <MetaItem label="Added" value={formatDate(plugin.created_at)} />
            <MetaItem
              label="Status"
              value={isEnriched ? 'Enriched' : 'Basic'}
              accent={isEnriched ? '#10b981' : '#f59e0b'}
            />
          </div>
        </div>

        {/* Description */}
        {plugin.description && (
          <div>
            <h3 className="text-text-dark text-[10px] font-bold uppercase tracking-[0.15em] mb-2">Description</h3>
            <p className="text-text-secondary text-[11px] leading-relaxed">{plugin.description}</p>
          </div>
        )}

        {/* File locations */}
        <div>
          <h3 className="text-text-dark text-[10px] font-bold uppercase tracking-[0.15em] mb-3">File Locations</h3>
          <div className="space-y-2">
            {plugin.filePaths.map((fp, i) => (
              <div key={i} className="bg-base border border-border p-2.5 group/file">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 ${
                      fp.format === 'VST3' ? 'bg-accent/20 text-accent' : 'bg-accent-blue/20 text-accent-blue'
                    }`}
                  >
                    {fp.format}
                  </span>
                  {fp.size && (
                    <span className="text-[9px] text-text-dark">{formatFileSize(fp.size)}</span>
                  )}
                  <button
                    onClick={() => handleShowInFolder(fp.path)}
                    className="ml-auto text-text-dark hover:text-accent transition-colors opacity-0 group-hover/file:opacity-100"
                    title="Show in Explorer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                  </button>
                </div>
                <p className="text-[9px] text-text-dark font-mono truncate" title={fp.path}>
                  {fp.path}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Website */}
        {plugin.website && (
          <div>
            <h3 className="text-text-dark text-[10px] font-bold uppercase tracking-[0.15em] mb-2">Website</h3>
            <button
              onClick={() => window.open(plugin.website!, '_blank')}
              className="flex items-center gap-1.5 text-[11px] text-text-dark hover:text-accent transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              {plugin.website}
            </button>
          </div>
        )}

        {/* Tags */}
        <div className="pt-2 border-t border-border">
          <h3 className="text-text-dark text-[10px] font-bold uppercase tracking-[0.15em] mb-3">Tags</h3>
          <TagPicker entityType="vst" entityId={plugin.id} />
        </div>
      </div>
    </div>
  )
}

function MetaItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-base border border-border p-2.5">
      <p className="text-text-dark text-[9px] uppercase font-bold tracking-[0.15em] mb-1">{label}</p>
      <p className="text-[13px] font-bold truncate tracking-tight" style={{ color: accent ?? 'white' }}>
        {value}
      </p>
    </div>
  )
}
