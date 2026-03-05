export default function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-base border border-border max-w-2xl mx-auto mt-10">
      <div className="w-16 h-16 border border-border flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-text-darker" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-text text-[13px] font-bold tracking-[0.2em] uppercase mb-2">{title}</h3>
      <p className="text-text-muted text-[11px] mb-8 max-w-sm leading-relaxed tracking-wider">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-accent hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest transition-all duration-200"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
