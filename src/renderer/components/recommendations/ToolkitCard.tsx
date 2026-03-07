export function ToolkitCard({
  icon,
  count,
  label,
  color,
  action
}: {
  icon: React.ReactNode
  count: number
  label: string
  color: string
  action?: { label: string; onClick: () => void }
}) {
  if (count === 0) return null
  return (
    <div className="relative flex items-center gap-3 px-4 py-3 bg-surface border border-border overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }} />
      <div style={{ color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-text">{count.toLocaleString()}</span>
        <span className="text-[10px] text-text-dark ml-1.5">{label}</span>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border transition-colors shrink-0"
          style={{ color, borderColor: `${color}40`, background: `${color}10` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${color}20` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${color}10` }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
