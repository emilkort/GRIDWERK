import { memo, useCallback } from 'react'
import type { Sample } from '@/stores/sample.store'
import { useSampleStore } from '@/stores/sample.store'
import { useAudioPlayerStore } from '@/stores/audioPlayer.store'
import WaveformPreview from './WaveformPreview'
import useWaveform from '@/hooks/useWaveform'
import { getCamelotColor, getCamelotLabel, isCompatibleKey } from '@/utils/camelot'

interface SampleRowProps {
  sample: Sample
  isSelected: boolean
  isMultiSelected: boolean
  multiSelectedPaths?: string[]
  onSelect: (sample: Sample) => void
  onMultiToggle: (e: React.MouseEvent) => void
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
  multiSelectedPaths,
  onSelect,
  onMultiToggle,
  activeKeyFilter
}: SampleRowProps) {
  const hasWaveform = !!sample.has_waveform
  const { peaks } = useWaveform(
    hasWaveform ? sample.id : null,
    hasWaveform ? sample.waveform_data : null,
    hasWaveform
  )

  const isMyFile = useAudioPlayerStore((s) => s.currentFilePath === sample.file_path)
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying && s.currentFilePath === sample.file_path)
  const progress = useAudioPlayerStore((s) =>
    s.currentFilePath === sample.file_path && s.duration > 0
      ? s.currentTime / s.duration
      : 0
  )
  const play = useAudioPlayerStore((s) => s.play)
  const pause = useAudioPlayerStore((s) => s.pause)
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
      if (isMultiSelected && multiSelectedPaths && multiSelectedPaths.length > 1) {
        window.api.drag.startNative(multiSelectedPaths)
      } else {
        window.api.drag.startNative(sample.file_path)
      }
    },
    [sample.file_path, isMultiSelected, multiSelectedPaths]
  )

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleFavorite(sample.id)
    },
    [sample.id, toggleFavorite]
  )

  const keyColor = sample.musical_key ? getCamelotColor(sample.musical_key) : null
  const keyLabel = sample.musical_key ? getCamelotLabel(sample.musical_key) : null

  const keyDimmed =
    activeKeyFilter != null &&
    sample.musical_key != null &&
    !isCompatibleKey(activeKeyFilter, sample.musical_key)

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
      draggable
      onDragStart={handleDragStart}
    >
      {/* Multi-select checkbox */}
      <div
        className="flex-shrink-0 w-4 flex items-center justify-center cursor-pointer"
        onClick={onMultiToggle}
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
    </div>
  )
})
