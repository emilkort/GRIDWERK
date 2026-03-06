import { useEffect, useState, useRef, type ReactNode } from 'react'
import { useAnalyticsStore, type AnalyticsData } from '@/stores/analytics.store'

// ── Animated counter hook ──
function useAnimatedCount(target: number, duration = 800) {
  const [count, setCount] = useState(0)
  const ref = useRef<number>(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const start = ref.current
    const diff = target - start
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const val = Math.round(start + diff * eased)
      setCount(val)
      ref.current = val
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return count
}

// ── Scroll-triggered fade-in ──
function FadeIn({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  )
}

// ── Hero stat with animated number ──
function HeroStat({ label, value, suffix, accent, icon }: { label: string; value: number; suffix?: string; accent?: string; icon?: string }) {
  const animated = useAnimatedCount(value)
  return (
    <div className="flex flex-col items-center gap-1 px-4 group">
      {icon && <span className="text-lg mb-1 group-hover:scale-125 transition-transform duration-300">{icon}</span>}
      <div className={`text-3xl font-black tabular-nums tracking-tight ${accent || 'text-text'} group-hover:scale-110 transition-transform duration-300`}>
        {animated.toLocaleString()}{suffix}
      </div>
      <div className="text-[9px] font-bold text-text-darker uppercase tracking-[0.2em]">{label}</div>
    </div>
  )
}

// ── Progress ring (SVG donut) with animated stroke ──
function ProgressRing({ percent, label, size = 80, color = '#ff2d2d' }: { percent: number; label: string; size?: number; color?: string }) {
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const [animatedOffset, setAnimatedOffset] = useState(circumference)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedOffset(circumference - (percent / 100) * circumference)
    }, 300)
    return () => clearTimeout(timeout)
  }, [percent, circumference])
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-border" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="flex flex-col items-center -mt-[calc(50%+10px)]" style={{ marginTop: -(size / 2 + 10) }}>
        <span className="text-lg font-bold text-text">{percent}%</span>
      </div>
      <div className="text-[9px] font-bold text-text-darker uppercase tracking-[0.15em] mt-2">{label}</div>
    </div>
  )
}

// ── Horizontal bar chart with staggered animation ──
function BarChart({ title, items, maxCount, barColor = 'bg-accent' }: { title: string; items: { label: string; count: number }[]; maxCount: number; barColor?: string }) {
  if (items.length === 0) return null
  const [animate, setAnimate] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 100); return () => clearTimeout(t) }, [])
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">{title}</h3>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0
          return (
            <div key={item.label}>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] text-text-secondary truncate mr-2">{item.label}</span>
                <span className="text-[11px] text-text-dark font-bold tabular-nums shrink-0">{item.count}</span>
              </div>
              <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out`}
                  style={{ width: animate ? `${pct}%` : '0%', transitionDelay: `${i * 50}ms` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Key grid ──
function KeyGrid({ items }: { items: { key: string; count: number }[] }) {
  if (items.length === 0) return null
  const maxCount = Math.max(...items.map((i) => i.count))
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Key Distribution</h3>
      <div className="grid grid-cols-6 gap-1.5">
        {items.slice(0, 24).map((item) => {
          const intensity = maxCount > 0 ? item.count / maxCount : 0
          return (
            <div
              key={item.key}
              className="flex flex-col items-center justify-center p-2 border border-border transition-all duration-200 hover:scale-110 hover:z-10 cursor-default"
              style={{ backgroundColor: `rgba(255, 45, 45, ${intensity * 0.25})` }}
            >
              <span className="text-[10px] font-bold text-text">{item.key}</span>
              <span className="text-[9px] text-text-dark tabular-nums">{item.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tag cloud ──
function TagCloud({ tags }: { tags: AnalyticsData['topTags'] }) {
  if (tags.length === 0) return null
  const max = Math.max(...tags.map((t) => t.count))
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Top Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const scale = 0.7 + (tag.count / max) * 0.6
          return (
            <span
              key={tag.name}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border text-text-secondary hover:border-border-hover hover:bg-elevated/50 transition-all duration-200"
              style={{ fontSize: `${scale * 10}px` }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              {tag.name}
              <span className="text-text-dark font-bold">{tag.count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Project funnel ──
function FunnelChart({ stages }: { stages: { stage: string; count: number }[] }) {
  if (stages.length === 0) return null
  const maxCount = Math.max(...stages.map((s) => s.count), 1)
  const [animate, setAnimate] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 200); return () => clearTimeout(t) }, [])
  const stageConfig: Record<string, { label: string; color: string }> = {
    idea: { label: 'Idea', color: '#3b82f6' },
    in_progress: { label: 'In Progress', color: '#f97316' },
    mixing: { label: 'Mixing', color: '#8b5cf6' },
    done: { label: 'Done', color: '#22c55e' }
  }
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Project Pipeline</h3>
      <div className="space-y-3">
        {stages.map((s, i) => {
          const cfg = stageConfig[s.stage] || { label: s.stage, color: '#888' }
          const widthPct = (s.count / maxCount) * 100
          return (
            <div key={s.stage} className="flex items-center gap-3">
              <span className="text-[10px] text-text-secondary w-20 shrink-0 font-medium">{cfg.label}</span>
              <div className="flex-1 h-7 bg-elevated overflow-hidden flex items-center">
                <div
                  className="h-full flex items-center px-2.5 transition-all duration-700 ease-out"
                  style={{
                    width: animate ? `${Math.max(widthPct, 10)}%` : '0%',
                    backgroundColor: `${cfg.color}20`,
                    borderRight: `2px solid ${cfg.color}`,
                    transitionDelay: `${i * 100}ms`
                  }}
                >
                  <span className="text-[11px] font-bold text-text tabular-nums">{s.count}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Mini sparkline bar chart for projects per month ──
function MonthlyActivity({ items }: { items: { month: string; count: number }[] }) {
  if (items.length === 0) return null
  const max = Math.max(...items.map((i) => i.count), 1)
  const [animate, setAnimate] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 300); return () => clearTimeout(t) }, [])
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Monthly Activity</h3>
      <div className="flex items-end gap-1 h-20">
        {items.map((item, i) => {
          const heightPct = Math.max((item.count / max) * 100, 4)
          const monthLabel = item.month.split('-')[1]
          return (
            <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center justify-end" style={{ height: '60px' }}>
                <div
                  className="w-full bg-accent/40 hover:bg-accent/60 transition-all duration-300 rounded-t-sm"
                  style={{ height: animate ? `${heightPct}%` : '0%', transitionDelay: `${i * 40}ms` }}
                  title={`${item.month}: ${item.count} projects`}
                />
              </div>
              <span className="text-[8px] text-text-darker font-bold">{monthLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── VST Format split ──
function FormatSplit({ items }: { items: { format: string; count: number }[] }) {
  if (items.length === 0) return null
  const total = items.reduce((s, i) => s + i.count, 0)
  const colors: Record<string, string> = { VST2: '#3b82f6', VST3: '#ff2d2d' }
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Format Split</h3>
      <div className="flex h-3 rounded-full overflow-hidden bg-elevated mb-4">
        {items.map((f) => (
          <div
            key={f.format}
            className="h-full transition-all duration-700"
            style={{ width: `${(f.count / total) * 100}%`, backgroundColor: colors[f.format] || '#888' }}
          />
        ))}
      </div>
      <div className="flex justify-around">
        {items.map((f) => (
          <div key={f.format} className="flex flex-col items-center gap-1">
            <span className="text-xl font-bold text-text tabular-nums">{f.count}</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[f.format] || '#888' }} />
              <span className="text-[10px] text-text-dark uppercase tracking-wide font-bold">{f.format}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Recently added VSTs ──
function RecentVsts({ items }: { items: AnalyticsData['recentVsts'] }) {
  if (items.length === 0) return null
  const catColor: Record<string, string> = { Instrument: 'text-blue-400', Effect: 'text-emerald-400' }
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Recently Added VSTs</h3>
      <div className="space-y-2">
        {items.map((vst, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
            <span className="text-[11px] font-bold text-text uppercase tracking-wide truncate flex-1">
              {vst.plugin_name}
            </span>
            {vst.vendor && (
              <span className="text-[10px] text-text-dark shrink-0">{vst.vendor}</span>
            )}
            {vst.category && (
              <span className={`text-[9px] font-bold uppercase ${catColor[vst.category] || 'text-text-dark'}`}>
                {vst.category}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Insight card (small stat with icon) ──
function InsightCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-border p-4 hover:border-border-hover transition-all duration-300 group">
      <div className="flex items-start gap-3">
        <span className="text-xl group-hover:scale-110 transition-transform duration-300">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold text-text-darker uppercase tracking-[0.15em] mb-1">{label}</div>
          <div className="text-lg font-black text-text tabular-nums">{value}</div>
          {sub && <div className="text-[10px] text-text-dark mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

// ── Donut chart for sample formats ──
function SampleFormatsDonut({ items }: { items: { format: string; count: number }[] }) {
  if (items.length === 0) return null
  const total = items.reduce((s, i) => s + i.count, 0)
  const colors = ['#ff2d2d', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308']
  const size = 90
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Sample Formats</h3>
      <div className="flex items-center gap-5">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-border" />
          {items.slice(0, 8).map((item, i) => {
            const segLen = (item.count / total) * circumference
            const dashoffset = -offset
            offset += segLen
            return (
              <circle
                key={item.format}
                cx={size / 2} cy={size / 2} r={radius}
                stroke={colors[i % colors.length]}
                strokeWidth={stroke} fill="none"
                strokeDasharray={`${segLen} ${circumference - segLen}`}
                strokeDashoffset={dashoffset}
                className="transition-all duration-700"
              />
            )
          })}
        </svg>
        <div className="flex flex-col gap-1.5 flex-1">
          {items.slice(0, 6).map((item, i) => (
            <div key={item.format} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-[10px] text-text-secondary uppercase tracking-wide flex-1">{item.format}</span>
              <span className="text-[10px] text-text-dark font-bold tabular-nums">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Recent projects timeline ──
function RecentProjects({ items }: { items: { title: string; stage: string; created_at: number }[] }) {
  if (items.length === 0) return null
  const stageColors: Record<string, string> = {
    idea: '#3b82f6', in_progress: '#f97316', mixing: '#8b5cf6', done: '#22c55e'
  }
  return (
    <div className="bg-surface border border-border p-5 hover:border-border-hover transition-colors duration-300">
      <h3 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-4">Recent Projects</h3>
      <div className="space-y-2.5">
        {items.map((p, i) => {
          const date = new Date(p.created_at * 1000)
          const ago = formatTimeAgo(date)
          return (
            <div key={i} className="flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: stageColors[p.stage] || '#888' }}
              />
              <span className="text-[11px] font-bold text-text truncate flex-1">{p.title}</span>
              <span className="text-[9px] text-text-darker shrink-0">{ago}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
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
  const maxVstVendor = Math.max(...(data.vstsByVendor?.map((v) => v.count) ?? []), 1)
  const maxVstCategory = Math.max(...(data.vstsByCategory?.map((c) => c.count) ?? []), 1)

  return (
    <div className="flex-1 overflow-y-auto space-y-8">
      {/* ── Hero section ── */}
      <FadeIn>
        <div className="bg-surface border border-border p-8">
          <h1 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.2em] text-center mb-6">
            Your Production Workspace
          </h1>
          <div className="flex justify-center items-start gap-8 flex-wrap">
            <HeroStat label="Samples" value={data.totals.samples} icon="🎵" />
            <HeroStat label="VST Plugins" value={data.totals.vsts} icon="🎛️" />
            <HeroStat label="Songs" value={data.totals.songs ?? 0} icon="🎶" />
            <HeroStat label="Projects" value={data.totals.projects} icon="📁" />
            {data.totals.totalDiskMb > 0 && (
              <HeroStat label="Library Size" value={data.totals.totalDiskMb} suffix=" MB" icon="💾" />
            )}
          </div>

          {/* Progress rings row */}
          <div className="flex justify-center items-start gap-12 mt-8 pt-6 border-t border-border">
            <ProgressRing percent={data.totals.analyzedPercent} label="Samples Analyzed" color="#ff2d2d" />
            <ProgressRing percent={data.totals.vstEnrichedPercent} label="VSTs Enriched" color="#3b82f6" />
            {(data.totals.favoriteSamples > 0 || data.totals.favoriteVsts > 0) && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-accent tabular-nums">{data.totals.favoriteSamples}</span>
                    <span className="text-[8px] text-text-darker uppercase tracking-wider">Samples</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-accent tabular-nums">{data.totals.favoriteVsts}</span>
                    <span className="text-[8px] text-text-darker uppercase tracking-wider">VSTs</span>
                  </div>
                </div>
                <div className="text-[9px] font-bold text-text-darker uppercase tracking-[0.15em]">Favorites</div>
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {/* ── Insights row ── */}
      <FadeIn delay={100}>
        <div className="grid grid-cols-4 gap-3">
          {data.completionRate != null && (
            <InsightCard
              icon="🏁"
              label="Completion Rate"
              value={`${data.completionRate}%`}
              sub="Songs reaching done"
            />
          )}
          {data.avgVersionsPerSong != null && data.avgVersionsPerSong > 0 && (
            <InsightCard
              icon="🔄"
              label="Avg Versions / Song"
              value={`${data.avgVersionsPerSong}`}
              sub="Project files per song"
            />
          )}
          {data.mostProductiveDay && (
            <InsightCard
              icon="📅"
              label="Most Productive Day"
              value={data.mostProductiveDay.day}
              sub={`${data.mostProductiveDay.count} projects created`}
            />
          )}
          {data.totals.totalDiskMb > 0 && (
            <InsightCard
              icon="📊"
              label="Total Assets"
              value={`${(data.totals.samples + data.totals.vsts).toLocaleString()}`}
              sub={`${data.totals.totalDiskMb >= 1024 ? `${(data.totals.totalDiskMb / 1024).toFixed(1)} GB` : `${data.totals.totalDiskMb} MB`} on disk`}
            />
          )}
        </div>
      </FadeIn>

      {/* ── Samples section ── */}
      <FadeIn delay={200}>
        <div>
          <h2 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-3">Sample Library</h2>
          <div className="grid grid-cols-2 gap-3">
            <BarChart title="By Category" items={data.samplesByCategory.map((c) => ({ label: c.category, count: c.count }))} maxCount={maxCategory} />
            <BarChart title="BPM Distribution" items={data.samplesByBpmRange.map((b) => ({ label: b.range, count: b.count }))} maxCount={maxBpm} barColor="bg-blue-500" />
            <KeyGrid items={data.samplesByKey} />
            {data.topSampleFormats && data.topSampleFormats.length > 0 ? (
              <SampleFormatsDonut items={data.topSampleFormats} />
            ) : (
              <TagCloud tags={data.topTags} />
            )}
          </div>
          {data.topSampleFormats && data.topSampleFormats.length > 0 && data.topTags.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <TagCloud tags={data.topTags} />
            </div>
          )}
        </div>
      </FadeIn>

      {/* ── Projects section ── */}
      {(data.projectsByStage.length > 0 || data.projectsPerMonth.length > 0) && (
        <FadeIn delay={300}>
          <div>
            <h2 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-3">Projects</h2>
            <div className="grid grid-cols-2 gap-3">
              <FunnelChart stages={data.projectsByStage} />
              <MonthlyActivity items={data.projectsPerMonth} />
              {data.dawUsage.length > 0 && (
                <BarChart title="DAW Usage" items={data.dawUsage.map((d) => ({ label: d.name, count: d.count }))} maxCount={maxDaw} barColor="bg-purple-500" />
              )}
              {data.recentProjects && data.recentProjects.length > 0 && (
                <RecentProjects items={data.recentProjects} />
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {/* ── VST Plugins section ── */}
      {data.totals.vsts > 0 && (
        <FadeIn delay={400}>
          <div>
            <h2 className="text-[10px] font-bold text-text-darker uppercase tracking-[0.15em] mb-3">VST Plugins</h2>
            <div className="grid grid-cols-2 gap-3">
              <FormatSplit items={data.vstsByFormat ?? []} />
              <BarChart title="By Category" items={(data.vstsByCategory ?? []).map((c) => ({ label: c.category, count: c.count }))} maxCount={maxVstCategory} barColor="bg-emerald-500" />
              <BarChart title="Top Vendors" items={(data.vstsByVendor ?? []).map((v) => ({ label: v.vendor, count: v.count }))} maxCount={maxVstVendor} barColor="bg-blue-500" />
              <RecentVsts items={data.recentVsts ?? []} />
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  )
}
