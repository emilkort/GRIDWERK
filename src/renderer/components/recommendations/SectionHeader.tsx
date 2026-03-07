export function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {icon && <div className="text-accent">{icon}</div>}
      <div>
        <h2 className="text-[12px] font-bold text-text uppercase tracking-[0.15em]">{title}</h2>
        {subtitle && <p className="text-[10px] text-text-dark mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
