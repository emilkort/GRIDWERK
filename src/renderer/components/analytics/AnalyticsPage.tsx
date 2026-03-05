import { useEffect } from 'react'
import { useAnalyticsStore, type AnalyticsData } from '@/stores/analytics.store'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border p-5">
      <div className="text-[9px] font-bold text-text-darker uppercase tracking-[0.2em] mb-2">{label}</div>
      <div className="text-2xl font-bold text-text">{value}</div>
    </div>
  )
}

function BarChart({ title, items, maxCount }: { title: string; items: { label: string; count: number }[]; maxCount: number }) {
  if (items.length === 0) return null
  return (
    <div className="bg-surface border border-border p-5">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">{title}</h3>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-text-secondary">{item.label}</span>
              <span className="text-[11px] text-text-dark">{item.count}</span>
            </div>
            <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${maxCount > 0 ? (item.count / maxCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KeyGrid({ items }: { items: { key: string; count: number }[] }) {
  if (items.length === 0) return null
  const maxCount = Math.max(...items.map((i) => i.count))
  return (
    <div className="bg-surface border border-border p-5">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Key Distribution</h3>
      <div className="grid grid-cols-6 gap-1.5">
        {items.slice(0, 24).map((item) => {
          const intensity = maxCount > 0 ? item.count / maxCount : 0
          return (
            <div
              key={item.key}
              className="flex flex-col items-center justify-center p-2 rounded border border-border"
              style={{ backgroundColor: `rgba(255, 45, 45, ${intensity * 0.3})` }}
            >
              <span className="text-[10px] font-bold text-text">{item.key}</span>
              <span className="text-[9px] text-text-dark">{item.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TagCloud({ tags }: { tags: AnalyticsData['topTags'] }) {
  if (tags.length === 0) return null
  return (
    <div className="bg-surface border border-border p-5">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Top Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.name}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border text-[10px] text-text-secondary"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
            {tag.name}
            <span className="text-text-dark">{tag.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function FunnelChart({ stages }: { stages: { stage: string; count: number }[] }) {
  if (stages.length === 0) return null
  const maxCount = Math.max(...stages.map((s) => s.count), 1)
  const stageLabels: Record<string, string> = { idea: 'Idea', in_progress: 'In Progress', mixing: 'Mixing', done: 'Done' }
  return (
    <div className="bg-surface border border-border p-5">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Project Funnel</h3>
      <div className="space-y-3">
        {stages.map((s) => {
          const widthPct = (s.count / maxCount) * 100
          return (
            <div key={s.stage} className="flex items-center gap-3">
              <span className="text-[10px] text-text-secondary w-20 shrink-0">{stageLabels[s.stage] || s.stage}</span>
              <div className="flex-1 h-6 bg-elevated rounded overflow-hidden flex items-center">
                <div
                  className="h-full bg-accent/20 border-r-2 border-accent flex items-center px-2"
                  style={{ width: `${Math.max(widthPct, 8)}%` }}
                >
                  <span className="text-[10px] font-bold text-text">{s.count}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { data, loading, fetchData } = useAnalyticsStore()

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-text-dark text-[11px] uppercase tracking-widest">Loading analytics...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-text-dark text-[11px] uppercase tracking-widest">No data available</span>
      </div>
    )
  }

  const maxCategory = Math.max(...data.samplesByCategory.map((c) => c.count), 1)
  const maxBpm = Math.max(...data.samplesByBpmRange.map((b) => b.count), 1)
  const maxDaw = Math.max(...data.dawUsage.map((d) => d.count), 1)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-sm font-bold text-text uppercase tracking-[0.15em]">Analytics</h1>
        <p className="text-[11px] text-text-dark mt-1">Overview of your production workspace</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Samples" value={data.totals.samples.toLocaleString()} />
        <StatCard label="Projects" value={data.totals.projects} />
        <StatCard label="VST Plugins" value={data.totals.vsts} />
        <StatCard label="Analyzed" value={`${data.totals.analyzedPercent}%`} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-3">
        <BarChart
          title="Samples by Category"
          items={data.samplesByCategory.map((c) => ({ label: c.category, count: c.count }))}
          maxCount={maxCategory}
        />
        <BarChart
          title="BPM Distribution"
          items={data.samplesByBpmRange.map((b) => ({ label: b.range, count: b.count }))}
          maxCount={maxBpm}
        />
        <FunnelChart stages={data.projectsByStage} />
        <BarChart
          title="DAW Usage"
          items={data.dawUsage.map((d) => ({ label: d.name, count: d.count }))}
          maxCount={maxDaw}
        />
        <KeyGrid items={data.samplesByKey} />
        <TagCloud tags={data.topTags} />
      </div>
    </div>
  )
}
