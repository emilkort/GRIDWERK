export function SoundPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 bg-elevated border border-border">
      {color && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
      <span className="text-[9px] text-text-dark uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-bold text-text">{value}</span>
    </div>
  )
}
