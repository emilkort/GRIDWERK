import { useState } from 'react'
import { useUiStore, type Page } from '@/stores/ui.store'
import type { Theme } from '@/stores/ui.store'

const navItems: { id: Page; label: string; icon: string; section?: string }[] = [
  { id: 'daw-hub', label: 'DAW Hub', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z' },
  { id: 'vst-manager', label: 'VST Plugins', icon: 'M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5' },
  { id: 'sample-library', label: 'Samples', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-4h8m-4-12a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z' },
  { id: 'project-tracker', label: 'Projects', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'analytics', label: 'Analytics', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', section: 'Insights' },
  { id: 'recommendations', label: 'Discover', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z', section: 'Insights' }
]

export default function Sidebar() {
  const { currentPage, setPage, theme, toggleTheme } = useUiStore()
  const [backupStatus, setBackupStatus] = useState<string | null>(null)

  const handleBackup = async () => {
    setBackupStatus('Saving...')
    try {
      const result = await window.api.db.backup()
      setBackupStatus(result ? 'Saved!' : null)
    } catch {
      setBackupStatus('Failed')
    }
    setTimeout(() => setBackupStatus(null), 2000)
  }

  return (
    <aside className="w-52 bg-base border-r border-border flex flex-col shrink-0 z-20 dot-grid">
      {/* Logo */}
      <div className="h-14 px-5 flex items-center gap-3 border-b border-border">
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="none">
          {/* 3x3 grid forming a "G" shape */}
          <rect x="0" y="0" width="5" height="5" fill="#FF2D2D" />
          <rect x="7.5" y="0" width="5" height="5" fill="#FF2D2D" />
          <rect x="15" y="0" width="5" height="5" fill="#FF2D2D" />
          <rect x="0" y="7.5" width="5" height="5" fill="#FF2D2D" />
          <rect x="15" y="7.5" width="5" height="5" rx="0" fill="var(--color-text-darker)" />
          <rect x="0" y="15" width="5" height="5" fill="#FF2D2D" />
          <rect x="7.5" y="15" width="5" height="5" fill="#FF2D2D" />
          <rect x="15" y="15" width="5" height="5" fill="#FF2D2D" />
        </svg>
        <span className="text-text font-bold text-[12px] tracking-[0.15em] uppercase">
          Gridwerk
        </span>
      </div>

      {/* Nav label */}
      <div className="px-5 pt-6 pb-2">
        <span className="text-[9px] font-bold text-text-darker uppercase tracking-[0.2em]">
          Workspace
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col w-full px-3">
        {navItems.map((item, idx) => {
          const active = currentPage === item.id
          const showSectionLabel = item.section && (idx === 0 || navItems[idx - 1].section !== item.section)
          return (
            <div key={item.id}>
              {showSectionLabel && (
                <div className="px-2 pt-4 pb-2">
                  <span className="text-[9px] font-bold text-text-darker uppercase tracking-[0.2em]">
                    {item.section}
                  </span>
                </div>
              )}
              <button
                onClick={() => setPage(item.id)}
                className={`relative flex items-center gap-3 px-3 py-2.5 w-full text-left transition-all duration-150 ${
                  active ? 'text-text' : 'text-text-dark hover:text-text-secondary'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#FF2D2D]" />
                )}
                <svg
                  className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-text-dark'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="text-[10px] uppercase tracking-[0.12em] font-bold whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            </div>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-border px-3 py-4 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-2.5 w-full text-left text-text-dark hover:text-text-secondary transition-colors text-[10px] font-bold uppercase tracking-[0.12em]"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
          <span className="whitespace-nowrap">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button
          onClick={handleBackup}
          className="flex items-center gap-2 px-3 py-2.5 w-full text-left text-text-dark hover:text-text-secondary transition-colors text-[10px] font-bold uppercase tracking-[0.12em]"
          title="Backup database"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <span className="whitespace-nowrap">{backupStatus || 'Backup DB'}</span>
        </button>
      </div>
    </aside>
  )
}
