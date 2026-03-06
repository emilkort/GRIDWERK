import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useVstStore } from '@/stores/vst.store'
import type { VstGroupBy } from '@/stores/vst.store'
import { mergePlugins, type MergedVstPlugin } from '@/utils/vst-grouping'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import VstCard from './VstCard'

const HEADER_HEIGHT = 48
const ROW_HEIGHT = 260
const GAP = 16
const MIN_CARD_WIDTH = 200

type GroupHeaderItem = {
  type: 'group-header'
  label: string
  pluginCount: number
  isCollapsed: boolean
}

type CardRowItem = {
  type: 'card-row'
  plugins: MergedVstPlugin[]
}

type GridRowItem = GroupHeaderItem | CardRowItem

function GroupHeader({
  label,
  count,
  isCollapsed,
  onToggle
}: {
  label: string
  count: number
  isCollapsed: boolean
  onToggle: () => void
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-3 px-1 h-full group">
      <svg
        className={`w-3.5 h-3.5 text-text-dark transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
      <span className="text-text text-[11px] font-bold uppercase tracking-[0.08em]">{label}</span>
      <span className="text-text-dark text-[9px] font-bold uppercase tracking-wider">
        {count} plugin{count !== 1 ? 's' : ''}
      </span>
      <div className="flex-1 h-px bg-border" />
    </button>
  )
}

/** Get the grouping key for a plugin based on the groupBy mode */
function getGroupKey(plugin: MergedVstPlugin, groupBy: VstGroupBy): string {
  switch (groupBy) {
    case 'vendor':
      return plugin.vendor || 'Unknown'
    case 'category':
      return plugin.category || 'Unknown'
    case 'format':
      return plugin.formats.sort().join(' + ')
    default:
      return ''
  }
}

/** Sort group keys with "Unknown" at end */
function sortGroupKeys(keys: string[]): string[] {
  return keys.sort((a, b) =>
    a === 'Unknown' ? 1 : b === 'Unknown' ? -1 : a.localeCompare(b)
  )
}

interface VstGridProps {
  onPluginClick?: (plugin: MergedVstPlugin) => void
}

export default function VstGrid({ onPluginClick }: VstGridProps) {
  const plugins = useVstStore((s) => s.plugins)
  const loading = useVstStore((s) => s.loading)
  const vendorFilter = useVstStore((s) => s.filters.vendor)
  const groupBy = useVstStore((s) => s.filters.groupBy)
  const containerRef = useRef<HTMLDivElement>(null)
  const [colCount, setColCount] = useState(4)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

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

  const toggleCollapsed = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }, [])

  const rowItems: GridRowItem[] = useMemo(() => {
    const merged = mergePlugins(plugins)

    // ── No grouping — flat grid ──
    if (groupBy === 'none') {
      // Apply vendor filter even in flat mode
      const filtered = vendorFilter
        ? merged.filter((p) => (p.vendor || 'Unknown') === vendorFilter)
        : merged

      const items: GridRowItem[] = []
      for (let i = 0; i < filtered.length; i += colCount) {
        items.push({ type: 'card-row', plugins: filtered.slice(i, i + colCount) })
      }
      return items
    }

    // ── Grouped mode ──
    const groupMap = new Map<string, MergedVstPlugin[]>()
    for (const p of merged) {
      const key = getGroupKey(p, groupBy)
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(p)
    }

    const sortedKeys = sortGroupKeys(Array.from(groupMap.keys()))

    // Apply vendor filter (only relevant when groupBy is vendor)
    const filteredKeys = vendorFilter && groupBy === 'vendor'
      ? sortedKeys.filter((k) => k === vendorFilter)
      : sortedKeys

    const items: GridRowItem[] = []

    for (const key of filteredKeys) {
      let groupPlugins = groupMap.get(key)!

      // When not grouping by vendor but vendor filter is active, filter within groups
      if (vendorFilter && groupBy !== 'vendor') {
        groupPlugins = groupPlugins.filter((p) => (p.vendor || 'Unknown') === vendorFilter)
        if (groupPlugins.length === 0) continue
      }

      const isCollapsed = collapsedGroups.has(key)

      items.push({
        type: 'group-header',
        label: key,
        pluginCount: groupPlugins.length,
        isCollapsed
      })

      if (!isCollapsed) {
        for (let i = 0; i < groupPlugins.length; i += colCount) {
          items.push({
            type: 'card-row',
            plugins: groupPlugins.slice(i, i + colCount)
          })
        }
      }
    }

    return items
  }, [plugins, colCount, collapsedGroups, vendorFilter, groupBy])

  const virtualizer = useVirtualizer({
    count: rowItems.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => {
      const item = rowItems[index]
      return item.type === 'group-header' ? HEADER_HEIGHT : ROW_HEIGHT + GAP
    },
    overscan: 5
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
          const item = rowItems[virtualRow.index]

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: virtualRow.start,
                left: 0,
                right: 0,
                height: item.type === 'group-header' ? HEADER_HEIGHT : ROW_HEIGHT
              }}
            >
              {item.type === 'group-header' ? (
                <GroupHeader
                  label={item.label}
                  count={item.pluginCount}
                  isCollapsed={item.isCollapsed}
                  onToggle={() => toggleCollapsed(item.label)}
                />
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                    gap: GAP,
                    height: ROW_HEIGHT
                  }}
                >
                  {item.plugins.map((plugin) => (
                    <VstCard key={plugin.id} plugin={plugin} onClick={() => onPluginClick?.(plugin)} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
