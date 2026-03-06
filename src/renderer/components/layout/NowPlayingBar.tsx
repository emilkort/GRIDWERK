import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useAudioPlayerStore } from '@/stores/audioPlayer.store'
import { useSampleStore, type Sample } from '@/stores/sample.store'
import WaveformPreview from '../sample-library/WaveformPreview'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ── Progress section (re-renders on time ticks) ──────────────────────────────
const ProgressSection = memo(function ProgressSection({
  peaks,
  waveWidth
}: {
  peaks: number[]
  waveWidth: number
}) {
  const currentTime = useAudioPlayerStore((s) => s.currentTime)
  const duration = useAudioPlayerStore((s) => s.duration)
  const seek = useAudioPlayerStore((s) => s.seek)
  const progress = duration > 0 ? currentTime / duration : 0

  const handleSeek = useCallback(
    (ratio: number) => seek(ratio),
    [seek]
  )

  return (
    <>
      <span className="text-text-muted text-[11px] font-mono min-w-[32px] text-right select-none">
        {formatTime(currentTime)}
      </span>

      <div className="flex-1 h-10 flex items-center">
        {peaks.length > 0 && waveWidth > 0 ? (
          <WaveformPreview
            peaks={peaks}
            width={waveWidth}
            height={36}
            progress={progress}
            onClick={handleSeek}
          />
        ) : (
          <div
            className="w-full h-1.5 bg-border rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = (e.clientX - rect.left) / rect.width
              handleSeek(Math.max(0, Math.min(1, ratio)))
            }}
          >
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-75"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>

      <span className="text-text-muted text-[11px] font-mono min-w-[32px] select-none">
        {formatTime(duration)}
      </span>
    </>
  )
})

// ── Transport controls (only re-renders on isPlaying change) ─────────────────
const TransportControls = memo(function TransportControls() {
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying)
  const currentFilePath = useAudioPlayerStore((s) => s.currentFilePath)
  const play = useAudioPlayerStore((s) => s.play)
  const pause = useAudioPlayerStore((s) => s.pause)
  const stop = useAudioPlayerStore((s) => s.stop)
  const samples = useSampleStore((s) => s.samples)

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause()
    else if (currentFilePath) play(currentFilePath)
  }, [isPlaying, currentFilePath, play, pause])

  const handlePrev = useCallback(() => {
    if (!currentFilePath) return
    const idx = samples.findIndex((s) => s.file_path === currentFilePath)
    if (idx > 0) play(samples[idx - 1].file_path)
  }, [currentFilePath, samples, play])

  const handleNext = useCallback(() => {
    if (!currentFilePath) return
    const idx = samples.findIndex((s) => s.file_path === currentFilePath)
    if (idx >= 0 && idx < samples.length - 1) play(samples[idx + 1].file_path)
  }, [currentFilePath, samples, play])

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePrev}
        className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text transition-colors"
        title="Previous"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      <button
        onClick={handlePlayPause}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-white hover:bg-accent text-black hover:text-white transition-all duration-150"
      >
        {isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
          </svg>
        )}
      </button>

      <button
        onClick={handleNext}
        className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text transition-colors"
        title="Next"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6z" />
        </svg>
      </button>

      <button
        onClick={stop}
        className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text transition-colors ml-1"
        title="Stop"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
        </svg>
      </button>
    </div>
  )
})

// ── Main bar (only re-renders on track change) ───────────────────────────────
export default function NowPlayingBar() {
  const currentFilePath = useAudioPlayerStore((s) => s.currentFilePath)
  const samples = useSampleStore((s) => s.samples)

  const currentSample: Sample | null = useMemo(() => {
    if (!currentFilePath) return null
    return samples.find((s) => s.file_path === currentFilePath) ?? null
  }, [currentFilePath, samples])

  const peaks: number[] = useMemo(() => {
    if (!currentSample?.waveform_data) return []
    try {
      const data = currentSample.waveform_data
      if (Array.isArray(data)) return data
      if (typeof data === 'string') return JSON.parse(data)
      if (data?.type === 'Buffer' && Array.isArray(data.data)) {
        return Array.from(new Float32Array(new Uint8Array(data.data).buffer))
      }
    } catch { /* ignore */ }
    return []
  }, [currentSample?.waveform_data])

  // Responsive waveform width
  const waveContainerRef = useRef<HTMLDivElement>(null)
  const [waveWidth, setWaveWidth] = useState(400)
  useEffect(() => {
    const el = waveContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWaveWidth(Math.floor(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!currentFilePath) return null

  const fileName = currentSample?.file_name
    ?? currentFilePath.split(/[\\/]/).pop()
    ?? 'Unknown'
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')

  return (
    <div className="h-16 border-t border-border bg-elevated flex items-center gap-3 px-4 shrink-0">
      {/* Track info — stable, no time-dependent re-renders */}
      <div className="flex flex-col min-w-[140px] max-w-[200px]">
        <span className="text-text text-[13px] font-medium truncate" title={fileName}>
          {nameWithoutExt}
        </span>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          {currentSample?.bpm && <span>{Math.round(currentSample.bpm)} BPM</span>}
          {currentSample?.musical_key && <span>{currentSample.musical_key}</span>}
          {currentSample?.category && currentSample.category !== 'other' && (
            <span className="capitalize">{currentSample.category}</span>
          )}
        </div>
      </div>

      <TransportControls />

      {/* Invisible container to measure available width for the waveform */}
      <div ref={waveContainerRef} className="flex-1 h-10 flex items-center gap-3">
        <ProgressSection peaks={peaks} waveWidth={waveWidth} />
      </div>
    </div>
  )
}
