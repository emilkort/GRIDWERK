export function ColorBar({
  label,
  count,
  maxCount,
  color
}: {
  label: string
  count: number
  maxCount: number
  color: { from: string; to: string }
}) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[9px] text-text-muted uppercase tracking-wider w-16 text-right shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-elevated/50 overflow-hidden relative">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color.from}, ${color.to})`,
            boxShadow: `0 0 12px ${color.from}30`
          }}
        />
      </div>
      <span className="text-[10px] font-bold text-text tabular-nums w-12 shrink-0 text-right">{count.toLocaleString()}</span>
    </div>
  )
}
