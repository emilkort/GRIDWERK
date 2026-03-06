import { memo, useCallback, useEffect, useRef } from 'react'

interface WaveformPreviewProps {
  peaks: number[]
  width: number
  height: number
  progress?: number
  onClick?: (ratio: number) => void
  accentColor?: string
}

export default memo(function WaveformPreview({
  peaks,
  width,
  height,
  progress = 0,
  onClick,
  accentColor = '#8b5cf6'
}: WaveformPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(progress)
  progressRef.current = progress

  // Track canvas pixel dimensions so we only call `canvas.width = ...` when
  // size changes. That assignment resets the full context (including DPR scale)
  // and is very expensive — avoid it on every 50ms progress tick.
  const lastSizeRef = useRef({ w: 0, h: 0, dpr: 0 })
  // Track filled bar count to skip redraws when progress hasn't crossed a bar boundary
  const lastFilledBarsRef = useRef(-1)

  const drawImpl = useCallback((forceRedraw = false) => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const last = lastSizeRef.current
    const barCount = peaks.length
    const gap = 1
    const barWidth = Math.max(1, (width - gap * (barCount - 1)) / barCount)
    const progressX = progressRef.current * width
    const filledBars = progressX > 0 ? Math.floor(progressX / (barWidth + gap)) : 0

    // Skip redraw if only progress changed but filled bar count is the same
    if (!forceRedraw && filledBars === lastFilledBarsRef.current && last.w === width * dpr) {
      return
    }
    lastFilledBarsRef.current = filledBars

    if (last.w !== width * dpr || last.h !== height * dpr || last.dpr !== dpr) {
      // Resize resets the canvas context — re-apply the DPR scale transform
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
      lastSizeRef.current = { w: width * dpr, h: height * dpr, dpr }
    } else {
      // Cheap clear — preserves the existing DPR scale transform
      ctx.clearRect(0, 0, width, height)
    }

    const centerY = height / 2

    // Pass 1: draw ALL bars in the unplayed color (one fillStyle assignment)
    ctx.fillStyle = '#4b5563'
    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap)
      const peakHeight = Math.max(1, peaks[i] * (height * 0.9))
      ctx.fillRect(x, centerY - peakHeight / 2, barWidth, peakHeight)
    }

    // Pass 2: overdraw the played portion in accent color (early exit at progressX)
    if (progressX > 0) {
      ctx.fillStyle = accentColor
      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + gap)
        if (x + barWidth / 2 > progressX) break
        const peakHeight = Math.max(1, peaks[i] * (height * 0.9))
        ctx.fillRect(x, centerY - peakHeight / 2, barWidth, peakHeight)
      }
    }
  }, [peaks, width, height, accentColor])

  // Structural changes (peaks/size/color) force a full redraw via new drawImpl ref.
  // Progress-only ticks go through the filledBars check and skip ~95% of redraws.
  const prevDrawImplRef = useRef(drawImpl)
  useEffect(() => {
    const isStructuralChange = drawImpl !== prevDrawImplRef.current
    prevDrawImplRef.current = drawImpl
    drawImpl(isStructuralChange)
  }, [drawImpl, progress])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onClick) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      onClick(Math.max(0, Math.min(1, ratio)))
    },
    [onClick]
  )

  if (peaks.length === 0) {
    return (
      <div
        className="bg-elevated rounded"
        style={{ width, height }}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, cursor: onClick ? 'pointer' : 'default' }}
      className="block"
      onClick={handleClick}
    />
  )
})
