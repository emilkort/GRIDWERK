import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react'
import type { Sample } from '@/stores/sample.store'
import { useSampleStore } from '@/stores/sample.store'
import { useAudioPlayerStore } from '@/stores/audioPlayer.store'
import { useShallow } from 'zustand/react/shallow'
import WaveformPreview from './WaveformPreview'
import useWaveform from '@/hooks/useWaveform'
import { getCamelotColor, getCamelotLabel, isCompatibleKey } from '@/utils/camelot'

interface SampleRowProps {
  sample: Sample
  isSelected: boolean
  isMultiSelected: boolean
  getMultiSelectedPaths: () => string[]
  onSelect: (sample: Sample) => void
  onMultiToggle: (sampleId: number, e: React.MouseEvent) => void
  onFindSimilar?: (sample: Sample) => void
  activeKeyFilter?: string | null
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '--:--'
  const totalSec = Math.floor(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default memo(function SampleRow({
  sample,
  isSelected,
  isMultiSelected,
  getMultiSelectedPaths,
  onSelect,
  onMultiToggle,
  onFindSimilar,
  activeKeyFilter
}: SampleRowProps) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [ctxMenu])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])
  const hasWaveform = !!sample.has_waveform
  const { peaks } = useWaveform(
    hasWaveform ? sample.id : null,
    hasWaveform ? sample.waveform_data : null,
    hasWaveform
  )

  const { isMyFile, isPlaying, progress, play, pause } = useAudioPlayerStore(
    useShallow((s) => ({
      isMyFile: s.currentFilePath === sample.file_path,
      isPlaying: s.isPlaying && s.currentFilePath === sample.file_path,
      progress: s.currentFilePath === sample.file_path && s.duration > 0
        ? s.currentTime / s.duration
        : 0,
      play: s.play,
      pause: s.pause,
    }))
  )
  const toggleFavorite = useSampleStore((s) => s.toggleFavorite)

  const handlePlayToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isPlaying) pause()
      else play(sample.file_path)
    },
    [isPlaying, sample.file_path, play, pause]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (isMultiSelected) {
        const paths = getMultiSelectedPaths()
        if (paths.length > 1) {
          window.api.drag.startNative(paths)
          return
        }
      }
      window.api.drag.startNative(sample.file_path)
    },
    [sample.file_path, isMultiSelected, getMultiSelectedPaths]
  )

  const handleMultiToggle = useCallback(
    (e: React.MouseEvent) => {
      onMultiToggle(sample.id, e)
    },
    [sample.id, onMultiToggle]
  )

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleFavorite(sample.id)
    },
    [sample.id, toggleFavorite]
  )

  const keyColor = useMemo(() => sample.musical_key ? getCamelotColor(sample.musical_key) : null, [sample.musical_key])
  const keyLabel = useMemo(() => sample.musical_key ? getCamelotLabel(sample.musical_key) : null, [sample.musical_key])

  const keyDimmed = useMemo(() =>
    activeKeyFilter != null &&
    sample.musical_key != null &&
    !isCompatibleKey(activeKeyFilter, sample.musical_key),
    [activeKeyFilter, sample.musical_key]
  )

  const isFav = !!sample.is_favorite

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-all duration-200 group border-l-2 ${
        isMultiSelected
          ? 'bg-accent/10 hover:bg-accent/15 border-l-accent/50'
          : isSelected
          ? 'bg-elevated border-l-accent'
          : 'bg-transparent hover:bg-surface border-l-transparent'
      } ${keyDimmed ? 'opacity-30' : ''}`}
      onClick={() => onSelect(sample)}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
    >
      {/* Multi-select checkbox */}
      <div
        className="flex-shrink-0 w-4 flex items-center justify-center cursor-pointer"
        onClick={handleMultiToggle}
      >
        <div
          className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${
            isMultiSelected
              ? 'bg-accent border-accent'
              : 'border-transparent group-hover:border-border-hover hover:border-white'
          }`}
        >
          {isMultiSelected && (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          )}
        </div>
      </div>

      {/* Drag handle */}
      <div className="flex-shrink-0 text-text-darker group-hover:text-text-muted cursor-grab active:cursor-grabbing">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      {/* Play button */}
      <button
        onClick={handlePlayToggle}
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-white hover:bg-accent text-black hover:text-white transition-all"
      >
        {isPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
          </svg>
        )}
      </button>

      {/* Mini waveform */}
      <div className="flex-shrink-0">
        <WaveformPreview
          peaks={peaks}
          width={200}
          height={34}
          progress={isMyFile ? progress : 0}
        />
      </div>

      {/* File name */}
      <div className="flex-1 min-w-0">
        <p className="text-text text-[14px] font-medium tracking-tight truncate">{sample.file_name}</p>
      </div>

      {/* Favorite button */}
      <button
        onClick={handleFavorite}
        className={`flex-shrink-0 transition-all duration-150 ${
          isFav
            ? 'opacity-100 text-red-400'
            : 'opacity-0 group-hover:opacity-60 text-gray-500 hover:text-red-400'
        }`}
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      </button>

      {/* Category badge */}
      {sample.category && (
        <span className="flex-shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 bg-elevated border border-border text-text-dark">
          {sample.category}
        </span>
      )}

      {/* BPM */}
      {sample.bpm && (
        <span className="flex-shrink-0 text-text-secondary text-[12px] font-medium w-12 text-right uppercase">
          {Math.round(sample.bpm)} bpm
        </span>
      )}

      {/* Musical key */}
      <span className="flex-shrink-0 w-8 text-center">
        {sample.musical_key ? (
          <span
            className="inline-flex items-center gap-0.5 text-[11px] font-bold"
            title={`${sample.musical_key} · ${keyLabel}`}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: keyColor ?? '#666' }} />
            <span style={{ color: keyColor ?? '#b3b3b3' }}>
              {sample.musical_key.replace(' maj', 'M').replace(' min', 'm')}
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-text-dark">—</span>
        )}
      </span>

      {/* Duration */}
      <span className="flex-shrink-0 text-text-secondary text-[12px] font-medium w-10 text-right">
        {formatDuration(sample.duration_ms)}
      </span>

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 bg-surface border border-border shadow-xl py-1 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {onFindSimilar && (
            <button
              className="w-full text-left px-3 py-1.5 text-[11px] text-text hover:bg-elevated transition-colors flex items-center gap-2"
              onClick={(e) => { e.stopPropagation(); setCtxMenu(null); onFindSimilar(sample) }}
            >
              <svg className="w-3.5 h-3.5 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Find Similar
            </button>
          )}
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-text hover:bg-elevated transition-colors flex items-center gap-2"
            onClick={(e) => { e.stopPropagation(); setCtxMenu(null); window.api.shell.showInFolder(sample.file_path) }}
          >
            <svg className="w-3.5 h-3.5 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            Show in Folder
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-text hover:bg-elevated transition-colors flex items-center gap-2"
            onClick={(e) => { e.stopPropagation(); setCtxMenu(null); navigator.clipboard.writeText(sample.file_path) }}
          >
            <svg className="w-3.5 h-3.5 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Copy Path
          </button>
        </div>
      )}
    </div>
  )
})
