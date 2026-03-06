import { useEffect, useState } from 'react'
import { useDiscoverStore } from '@/stores/recommendations.store'
import { useUiStore } from '@/stores/ui.store'
import { useVstStore } from '@/stores/vst.store'
import DuplicateResultsDialog from '@/components/sample-library/DuplicateResultsDialog'

const GRADIENT_COLORS = [
  { from: '#FF2D2D', to: '#ff6b6b' },
  { from: '#f97316', to: '#fbbf24' },
  { from: '#3b82f6', to: '#60a5fa' },
  { from: '#22c55e', to: '#4ade80' },
  { from: '#ec4899', to: '#f472b6' },
  { from: '#8b5cf6', to: '#a78bfa' },
]

const KEY_COLORS = [
  '#FF2D2D', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#6366f1', '#d946ef',
]

function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
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

function SoundPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 bg-elevated border border-border">
      {color && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
      <span className="text-[9px] text-text-dark uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-bold text-text">{value}</span>
    </div>
  )
}

function ToolkitCard({
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

function ColorBar({
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

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) {
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

function formatTimeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 2592000)}mo ago`
}

export default function RecommendationsPage() {
  const { data, loading, fetchData } = useDiscoverStore()
  const setPage = useUiStore((s) => s.setPage)
  const enrichAll = useVstStore((s) => s.enrichAll)
  const enriching = useVstStore((s) => s.enriching)
  const [autoTagging, setAutoTagging] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)

  const handleAutoTag = async () => {
    setAutoTagging(true)
    try {
      const result = await window.api.sample.autoTag()
      console.log(`Auto-tagged ${result.tagged} samples, created ${result.tagsCreated} new tags`)
      fetchData()
    } catch (err) {
      console.error('Auto-tag failed:', err)
    } finally {
      setAutoTagging(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-6 h-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-text-dark text-[11px] uppercase tracking-widest">Loading insights...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span className="text-text-dark text-[11px] uppercase tracking-widest">No data yet</span>
        <p className="text-text-dark text-[10px]">Add samples, VSTs, or projects to see your dashboard</p>
      </div>
    )
  }

  const { profile, toolkit, sampleInsights, suggestions, pluginChains, workflow, activity } = data

  const bpmMax = Math.max(...sampleInsights.bpmDistribution.map((b) => b.count), 1)
  const keyMax = Math.max(...sampleInsights.keyDistribution.map((k) => k.count), 1)
  const formatMax = Math.max(...sampleInsights.topFormats.map((f) => f.count), 1)

  const hasToolkitItems =
    toolkit.unenrichedVstCount > 0 ||
    toolkit.unanalyzedSampleCount > 0 ||
    toolkit.untaggedSampleCount > 0 ||
    toolkit.untaggedVstCount > 0 ||
    toolkit.duplicateSampleCount > 0 ||
    toolkit.stalledProjects.length > 0

  const hasSuggestions =
    suggestions.unexploredVstCategories.length > 0 ||
    suggestions.similarToFavoriteVsts.length > 0 ||
    suggestions.underusedVendors.length > 0

  // Interleave recent activity by date
  const activityItems = [
    ...activity.recentProjects.map((p) => ({ type: 'project' as const, id: p.id, name: p.title, detail: p.stage, time: p.createdAt })),
    ...activity.recentVsts.map((v) => ({ type: 'vst' as const, id: v.id, name: v.pluginName, detail: v.vendor, time: v.createdAt, iconUrl: v.iconUrl }))
  ].sort((a, b) => b.time - a.time).slice(0, 8)

  return (
    <div className="flex-1 overflow-y-auto pr-2 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-[0.05em] uppercase">Discover</h1>
          <p className="text-text-muted text-[11px] mt-1.5 tracking-wider uppercase">Insights and suggestions for your production workflow</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-transparent border border-border hover:border-border-hover text-text text-[11px] font-bold uppercase tracking-widest transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Section 1: Producer Profile */}
      <div className="bg-surface border border-border p-6">
        <SectionHeader
          title="Your Profile"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <div className="flex flex-wrap gap-2.5 mb-5">
          <StatPill label="Samples" value={profile.totalSamples.toLocaleString()} color="#3b82f6" />
          <StatPill label="VSTs" value={profile.totalVsts.toLocaleString()} color="#8b5cf6" />
          <StatPill label="Projects" value={profile.totalProjects.toLocaleString()} color="#22c55e" />
          <StatPill label="Fav Samples" value={profile.favoriteSamples.toLocaleString()} color="#f97316" />
          <StatPill label="Fav VSTs" value={profile.favoriteVsts.toLocaleString()} color="#ec4899" />
          <StatPill label="Completion" value={`${profile.completionRate}%`} color="#FF2D2D" />
        </div>
        {(profile.topBpmRange || profile.topKey || profile.topCategory || profile.mostProductiveDay) && (
          <div>
            <span className="text-[9px] text-text-dark uppercase tracking-widest block mb-2.5">Your Sound</span>
            <div className="flex flex-wrap gap-2">
              {profile.topBpmRange && <SoundPill label="BPM" value={profile.topBpmRange} color="#FF2D2D" />}
              {profile.topKey && <SoundPill label="Key" value={profile.topKey} color="#3b82f6" />}
              {profile.topCategory && <SoundPill label="Category" value={profile.topCategory} color="#22c55e" />}
              {profile.mostProductiveDay && <SoundPill label="Peak Day" value={profile.mostProductiveDay} color="#f97316" />}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Toolkit Health */}
      {hasToolkitItems && (
        <div>
          <SectionHeader
            title="Toolkit Health"
            subtitle="Things that need your attention"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.66 5.66a2.12 2.12 0 01-3-3l5.66-5.66m0 0L3.34 8.59a2.12 2.12 0 010-3l.71-.71a2.12 2.12 0 013 0l3.09 3.09m0 0l4.24-4.24a2.12 2.12 0 013 0l.71.71a2.12 2.12 0 010 3l-4.24 4.24" /></svg>}
          />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            <ToolkitCard
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>}
              count={toolkit.unenrichedVstCount}
              label="VSTs need enrichment"
              color="#8b5cf6"
              action={{ label: enriching ? 'Enriching...' : 'Enrich', onClick: enrichAll }}
            />
            <ToolkitCard
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
              count={toolkit.unanalyzedSampleCount}
              label="samples not analyzed"
              color="#f97316"
            />
            <ToolkitCard
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>}
              count={toolkit.untaggedSampleCount}
              label="samples untagged"
              color="#3b82f6"
              action={{ label: autoTagging ? 'Tagging...' : 'Auto-Tag', onClick: handleAutoTag }}
            />
            <ToolkitCard
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>}
              count={toolkit.untaggedVstCount}
              label="VSTs untagged"
              color="#ec4899"
            />
            <ToolkitCard
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>}
              count={toolkit.duplicateSampleCount}
              label="potential duplicate groups"
              color="#fbbf24"
              action={{ label: 'Clean Up', onClick: () => setShowDuplicates(true) }}
            />
            {toolkit.stalledProjects.length > 0 && (
              <div className="relative flex flex-col gap-1.5 px-4 py-3 bg-surface border border-border col-span-full overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent-red" />
                <div className="flex items-center gap-2 mb-0.5">
                  <svg className="w-4 h-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[11px] font-bold text-text">{toolkit.stalledProjects.length} stalled projects</span>
                  <span className="text-[9px] text-text-dark">(no updates in 30+ days)</span>
                </div>
                {toolkit.stalledProjects.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 pl-6">
                    <span className="text-[10px] text-text">{p.title}</span>
                    <span className="text-[9px] text-text-dark px-1.5 py-0.5 bg-elevated border border-border">{p.stage}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 3: Sample Library Insights */}
      {(sampleInsights.bpmDistribution.length > 0 || sampleInsights.keyDistribution.length > 0) && (
        <div>
          <SectionHeader
            title="Sample Library Insights"
            subtitle="Your collection at a glance"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>}
          />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* BPM Distribution */}
            {sampleInsights.bpmDistribution.length > 0 && (
              <div className="bg-surface border border-border p-5">
                <span className="text-[10px] font-bold text-text uppercase tracking-widest block mb-4">BPM Distribution</span>
                <div className="space-y-2">
                  {sampleInsights.bpmDistribution.map((b, i) => (
                    <ColorBar
                      key={b.range}
                      label={b.range}
                      count={b.count}
                      maxCount={bpmMax}
                      color={GRADIENT_COLORS[i % GRADIENT_COLORS.length]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Key Distribution */}
            {sampleInsights.keyDistribution.length > 0 && (
              <div className="bg-surface border border-border p-5">
                <span className="text-[10px] font-bold text-text uppercase tracking-widest block mb-4">Key Distribution</span>
                <div className="flex flex-wrap gap-2">
                  {sampleInsights.keyDistribution.map((k, i) => {
                    const intensity = 0.3 + (k.count / keyMax) * 0.7
                    const color = KEY_COLORS[i % KEY_COLORS.length]
                    return (
                      <div
                        key={k.key}
                        className="relative flex flex-col items-center justify-center w-14 h-14 overflow-hidden"
                        style={{
                          background: `${color}${Math.round(intensity * 25).toString(16).padStart(2, '0')}`,
                          border: `1px solid ${color}${Math.round(intensity * 50).toString(16).padStart(2, '0')}`
                        }}
                      >
                        <span className="text-[11px] font-bold text-text">{k.key}</span>
                        <span className="text-[8px] text-text-dark">{k.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Format + Duration */}
            <div className="bg-surface border border-border p-5">
              {sampleInsights.topFormats.length > 0 && (
                <div className="mb-5">
                  <span className="text-[10px] font-bold text-text uppercase tracking-widest block mb-4">Formats</span>
                  <div className="space-y-2">
                    {sampleInsights.topFormats.map((f, i) => (
                      <ColorBar
                        key={f.format}
                        label={`.${f.format}`}
                        count={f.count}
                        maxCount={formatMax}
                        color={GRADIENT_COLORS[(i + 2) % GRADIENT_COLORS.length]}
                      />
                    ))}
                  </div>
                </div>
              )}
              {sampleInsights.avgDuration != null && (
                <div className="flex items-baseline gap-2 pt-3 border-t border-border">
                  <span className="text-[9px] text-text-dark uppercase tracking-widest">Avg Duration</span>
                  <span className="text-lg font-bold text-text">{(sampleInsights.avgDuration / 1000).toFixed(1)}<span className="text-[10px] text-text-dark ml-0.5">sec</span></span>
                </div>
              )}
            </div>
          </div>

          {/* Recent samples */}
          {sampleInsights.recentSamples.length > 0 && (
            <div className="mt-3 bg-surface border border-border p-4">
              <span className="text-[10px] font-bold text-text uppercase tracking-widest block mb-3">Recently Added Samples</span>
              <div className="space-y-1.5">
                {sampleInsights.recentSamples.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GRADIENT_COLORS[i % GRADIENT_COLORS.length].from }} />
                    <span className="text-text truncate flex-1">{s.fileName}</span>
                    {s.category && <span className="text-text-dark px-1.5 py-0.5 bg-elevated border border-border shrink-0">{s.category}</span>}
                    {s.bpm && <span className="text-text-muted tabular-nums shrink-0">{s.bpm} BPM</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 4: Suggestions */}
      {hasSuggestions && (
        <div>
          <SectionHeader
            title="Suggestions"
            subtitle="Explore what you're missing"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>}
          />

          {/* Unexplored VST Categories */}
          {suggestions.unexploredVstCategories.length > 0 && (
            <div className="mb-5">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-2.5">Unexplored VST Categories</span>
              <div className="flex flex-wrap gap-2">
                {suggestions.unexploredVstCategories.map((cat, i) => {
                  const color = GRADIENT_COLORS[i % GRADIENT_COLORS.length]
                  return (
                    <button
                      key={cat.category}
                      onClick={() => setPage('vst-manager')}
                      className="relative flex items-center gap-2.5 px-3.5 py-2 bg-surface border border-border hover:border-border-hover transition-all group overflow-hidden"
                    >
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-all group-hover:h-[3px]" style={{ background: `linear-gradient(90deg, ${color.from}, ${color.to})` }} />
                      <span className="text-[10px] font-bold text-text uppercase tracking-widest">{cat.category}</span>
                      <span className="text-[9px] text-text-dark tabular-nums">{cat.count}</span>
                      <svg className="w-3 h-3 text-text-dark group-hover:text-text transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Similar to Favorites */}
          {suggestions.similarToFavoriteVsts.length > 0 && (
            <div className="mb-5">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-2.5">Similar to Your Favorites</span>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                {suggestions.similarToFavoriteVsts.map((v, i) => {
                  const color = GRADIENT_COLORS[i % GRADIENT_COLORS.length]
                  return (
                    <div key={v.id} className="relative flex items-center gap-3 px-3.5 py-3 bg-surface border border-border overflow-hidden group hover:border-border-hover transition-colors">
                      <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: color.from }} />
                      {v.iconUrl ? (
                        <img src={v.iconUrl} className="w-8 h-8 object-contain shrink-0" />
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: `${color.from}15`, border: `1px solid ${color.from}30` }}>
                          <span className="text-[8px] font-bold" style={{ color: color.from }}>VST</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-text block truncate">{v.pluginName}</span>
                        {v.vendor && <span className="text-[9px] text-text-dark block truncate">{v.vendor}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Underused Vendors */}
          {suggestions.underusedVendors.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-2.5">Vendors You Haven't Explored</span>
              <div className="flex flex-wrap gap-2">
                {suggestions.underusedVendors.map((v, i) => {
                  const color = GRADIENT_COLORS[i % GRADIENT_COLORS.length]
                  return (
                    <div key={v.vendor} className="relative flex items-center gap-2.5 px-3.5 py-2.5 bg-surface border border-border overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: color.from }} />
                      <span className="text-[10px] font-bold text-text">{v.vendor}</span>
                      <span className="text-[9px] text-text-dark">{v.totalCount} plugins</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 5: Plugin Chains */}
      {(pluginChains.coUsed.length > 0 || pluginChains.suggestedForFavorites.length > 0) && (
        <div>
          <SectionHeader
            title="Plugin Chains"
            subtitle="How your plugins work together in projects"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>}
          />

          {/* Co-used pairs */}
          {pluginChains.coUsed.length > 0 && (
            <div className="mb-5">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-3">Most Co-Used Plugin Pairs</span>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {pluginChains.coUsed.map((pair, i) => {
                  const color = GRADIENT_COLORS[i % GRADIENT_COLORS.length]
                  return (
                    <div key={`${pair.pluginA}-${pair.pluginB}`} className="relative flex items-center gap-2 px-4 py-3 bg-surface border border-border overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }} />
                      <span className="text-[10px] font-bold text-text truncate">{pair.pluginA}</span>
                      <svg className="w-3 h-3 text-text-dark shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                      </svg>
                      <span className="text-[10px] font-bold text-text truncate">{pair.pluginB}</span>
                      <span className="ml-auto text-[9px] font-bold shrink-0 px-1.5 py-0.5" style={{ color: color.from, background: `${color.from}15`, border: `1px solid ${color.from}30` }}>
                        {pair.projectCount} project{pair.projectCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Suggested plugins based on favorites */}
          {pluginChains.suggestedForFavorites.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-3">You Might Like</span>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                {pluginChains.suggestedForFavorites.map((s, i) => {
                  const color = GRADIENT_COLORS[i % GRADIENT_COLORS.length]
                  return (
                    <div key={`${s.pluginName}-${s.reason}`} className="relative px-4 py-3 bg-surface border border-border overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color.from}, ${color.to})` }} />
                      <span className="text-[10px] font-bold text-text block truncate">{s.pluginName}</span>
                      <span className="text-[9px] text-text-dark block mt-0.5 truncate">
                        Co-used with <span style={{ color: color.from }}>{s.reason}</span> in {s.coUseCount} project{s.coUseCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 6: Workflow Patterns */}
      {(workflow.projectsPerMonth.length > 0 || workflow.avgProjectDuration != null) && (
        <div>
          <SectionHeader
            title="Workflow Patterns"
            subtitle="Your production rhythm and habits"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Stats row */}
            <div className="bg-surface border border-border p-5">
              <span className="text-[10px] font-bold text-text uppercase tracking-widest block mb-4">Overview</span>
              <div className="space-y-3">
                {workflow.avgProjectDuration != null && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[9px] text-text-dark uppercase tracking-widest">Avg time to finish</span>
                    <span className="text-lg font-bold text-text">{workflow.avgProjectDuration}<span className="text-[10px] text-text-dark ml-1">days</span></span>
                  </div>
                )}
                {workflow.productiveStreak > 0 && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[9px] text-text-dark uppercase tracking-widest">Current streak</span>
                    <span className="text-lg font-bold text-text" style={{ color: '#22c55e' }}>{workflow.productiveStreak}<span className="text-[10px] text-text-dark ml-1">week{workflow.productiveStreak !== 1 ? 's' : ''}</span></span>
                  </div>
                )}
                {workflow.daysSinceLastProject != null && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[9px] text-text-dark uppercase tracking-widest">Since last project</span>
                    <span className="text-lg font-bold text-text">{workflow.daysSinceLastProject}<span className="text-[10px] text-text-dark ml-1">days</span></span>
                  </div>
                )}
              </div>
            </div>

            {/* Weekday distribution */}
            {workflow.weekdayDistribution.length > 0 && (() => {
              const maxDay = Math.max(...workflow.weekdayDistribution.map(d => d.count), 1)
              return (
                <div className="bg-surface border border-border p-5">
                  <span className="text-[10px] font-bold text-text uppercase tracking-widest block mb-4">Weekday Activity</span>
                  <div className="flex items-end gap-2 h-24">
                    {workflow.weekdayDistribution.map((d, i) => {
                      const pct = (d.count / maxDay) * 100
                      const color = GRADIENT_COLORS[i % GRADIENT_COLORS.length]
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-text-muted font-bold tabular-nums">{d.count || ''}</span>
                          <div className="w-full relative" style={{ height: '60px' }}>
                            <div
                              className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                              style={{
                                height: `${Math.max(pct, 4)}%`,
                                background: `linear-gradient(180deg, ${color.from}, ${color.to})`,
                                boxShadow: d.count > 0 ? `0 0 8px ${color.from}30` : 'none'
                              }}
                            />
                          </div>
                          <span className="text-[8px] text-text-dark uppercase tracking-wider font-bold">{d.day}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Monthly output */}
          {workflow.projectsPerMonth.length > 0 && (() => {
            const maxMonth = Math.max(...workflow.projectsPerMonth.map(m => m.count), 1)
            return (
              <div className="bg-surface border border-border p-5 mt-4">
                <span className="text-[10px] font-bold text-text uppercase tracking-widest block mb-4">Monthly Output</span>
                <div className="space-y-2">
                  {workflow.projectsPerMonth.map((m, i) => (
                    <ColorBar
                      key={m.month}
                      label={m.month}
                      count={m.count}
                      maxCount={maxMonth}
                      color={GRADIENT_COLORS[i % GRADIENT_COLORS.length]}
                    />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Section 7: Recent Activity */}
      {activityItems.length > 0 && (
        <div>
          <SectionHeader
            title="Recent Activity"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <div className="space-y-1.5">
            {activityItems.map((item, i) => (
              <div key={`${item.type}-${item.id}-${i}`} className="relative flex items-center gap-3 px-4 py-2.5 bg-surface border border-border overflow-hidden group hover:border-border-hover transition-colors">
                <div
                  className="absolute left-0 top-0 bottom-0 w-[2px]"
                  style={{ background: item.type === 'project' ? '#22c55e' : '#8b5cf6' }}
                />
                {item.type === 'project' ? (
                  <svg className="w-4 h-4 text-accent-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                  </svg>
                ) : (item as any).iconUrl ? (
                  <img src={(item as any).iconUrl} className="w-4 h-4 object-contain shrink-0" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" style={{ color: '#8b5cf6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.491 48.491 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
                  </svg>
                )}
                <span className="text-[10px] font-bold text-text truncate">{item.name}</span>
                <span
                  className="text-[9px] px-1.5 py-0.5 border text-text-dark uppercase tracking-wider shrink-0"
                  style={{
                    borderColor: item.type === 'project' ? '#22c55e30' : '#8b5cf630',
                    background: item.type === 'project' ? '#22c55e10' : '#8b5cf610'
                  }}
                >
                  {item.type === 'project' ? item.detail : 'VST'}
                </span>
                {item.type === 'vst' && item.detail && (
                  <span className="text-[9px] text-text-dark truncate">{item.detail}</span>
                )}
                <span className="text-[9px] text-text-dark ml-auto shrink-0">{formatTimeAgo(item.time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate cleanup dialog */}
      {showDuplicates && (
        <DuplicateResultsDialog onClose={() => { setShowDuplicates(false); fetchData() }} />
      )}
    </div>
  )
}
