import { useRef, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useVstStore } from '@/stores/vst.store'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import VstCard from './VstCard'

const ROW_HEIGHT = 164
const GAP = 16
const MIN_CARD_WIDTH = 200

export default function VstGrid() {
  const plugins = useVstStore((s) => s.plugins)
  const loading = useVstStore((s) => s.loading)
  const containerRef = useRef<HTMLDivElement>(null)
  const [colCount, setColCount] = useState(4)

  const updateCols = useCallback(() => {
    if (!containerRef.current) return
    const width = containerRef.current.clientWidth
    setColCount(Math.max(1, Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP))))
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    updateCols()
    const observer = new ResizeObserver(updateCols)
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateCols])

  const rowCount = Math.ceil(plugins.length / colCount)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 3
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * colCount
          const rowPlugins = plugins.slice(startIdx, startIdx + colCount)

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: virtualRow.start,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
                display: 'grid',
                gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                gap: GAP
              }}
            >
              {rowPlugins.map((plugin) => (
                <VstCard key={plugin.id} plugin={plugin} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
