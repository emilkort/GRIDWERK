export function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center px-5 py-3.5 bg-surface border border-border min-w-[110px] overflow-hidden group hover:border-border-hover transition-colors">
      {color && (
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />
      )}
      <span className="text-xl font-bold text-text tabular-nums">{value}</span>
      <span className="text-[9px] text-text-dark uppercase tracking-widest mt-1">{label}</span>
    </div>
  )
}
