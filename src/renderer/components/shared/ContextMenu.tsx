import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
}

export interface ContextMenuProps {
  position: { x: number; y: number } | null
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!position) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [position, onClose])

  if (!position) return null

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface border border-border shadow-xl py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-text hover:bg-elevated'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            item.onClick()
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
