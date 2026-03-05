import { useEffect, useRef, memo } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useAudioPlayerStore } from '@/stores/audioPlayer.store'

interface WaveSurferWaveformProps {
  filePath: string
  peaks: number[]
  durationSec?: number
  height?: number
  accentColor?: string
}

export default memo(function WaveSurferWaveform({
  filePath,
  peaks,
  durationSec = 0,
  height = 80,
  accentColor = '#8b5cf6'
}: WaveSurferWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)

  // Build/rebuild the wavesurfer instance when sample or visual config changes
  useEffect(() => {
    if (!containerRef.current || peaks.length === 0) return

    wsRef.current?.destroy()

    const styles = getComputedStyle(document.documentElement)
    const waveCol = styles.getPropertyValue('--color-text-darker').trim() || '#374151'
    const cursorCol = styles.getPropertyValue('--color-text-muted').trim() || 'rgba(255,255,255,0.25)'

    const ws = WaveSurfer.create({
      container: containerRef.current,
      peaks: [peaks],
      duration: durationSec > 0 ? durationSec : undefined,
      height,
      waveColor: waveCol,
      progressColor: accentColor,
      cursorColor: cursorCol,
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
    })

    // Click-to-seek: newTime is in seconds
    ws.on('interaction', (newTime: number) => {
      const state = useAudioPlayerStore.getState()
      const dur = ws.getDuration() || durationSec
      const ratio = dur > 0 ? newTime / dur : 0
      if (state.currentFilePath === filePath) {
        state.seek(ratio)
      } else {
        // Play then seek — AudioBuffer decoding is instant when cached
        state.play(filePath).then(() => state.seek(ratio))
      }
    })

    wsRef.current = ws

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [filePath, peaks, durationSec, height, accentColor])

  // Sync store's currentTime → wavesurfer progress bar (updates ~20fps via rAF in the store)
  const currentTime = useAudioPlayerStore((s) =>
    s.currentFilePath === filePath ? s.currentTime : 0
  )
  useEffect(() => {
    wsRef.current?.setTime(currentTime)
  }, [currentTime])

  if (peaks.length === 0) {
    return <div className="bg-th-hover rounded-lg w-full" style={{ height }} />
  }

  return <div ref={containerRef} className="w-full" />
})
