import { useEffect } from 'react'
import { useVstStore } from '@/stores/vst.store'

interface VstHiddenDrawerProps {
  open: boolean
  onClose: () => void
}

export default function VstHiddenDrawer({ open, onClose }: VstHiddenDrawerProps) {
  const hiddenPlugins = useVstStore((s) => s.hiddenPlugins)
  const hiddenLoading = useVstStore((s) => s.hiddenLoading)
  const fetchHiddenPlugins = useVstStore((s) => s.fetchHiddenPlugins)
  const unhidePlugin = useVstStore((s) => s.unhidePlugin)

  useEffect(() => {
    if (open) fetchHiddenPlugins()
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-base border-l border-border z-50 flex flex-col shadow-2xl shadow-black/80">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-text font-bold text-[13px] tracking-[0.15em] uppercase">
              Hidden Plugins
            </h2>
            <p className="text-text-dark text-[10px] tracking-wider uppercase mt-1">
              {hiddenPlugins.length} plugin{hiddenPlugins.length !== 1 ? 's' : ''} hidden
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-dark hover:text-text transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {hiddenLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
            </div>
          ) : hiddenPlugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-dark">
              <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-[11px] uppercase tracking-wider">No hidden plugins</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {hiddenPlugins.map((plugin) => (
                <div
                  key={plugin.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-elevated/50 transition-colors group"
                >
                  {/* Icon */}
                  {plugin.icon_url && !plugin.icon_url.startsWith('data:') ? (
                    <img
                      src={plugin.icon_url}
                      alt=""
                      className="w-8 h-8 object-contain rounded shrink-0 opacity-50 group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-elevated rounded flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-text-dark">
                        {plugin.plugin_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-[12px] font-bold truncate tracking-wide uppercase">
                      {plugin.plugin_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {plugin.vendor && (
                        <span className="text-text-dark text-[10px] tracking-wider truncate">
                          {plugin.vendor}
                        </span>
                      )}
                      <span className="text-text-darker text-[9px] font-bold uppercase">
                        {plugin.format}
                      </span>
                    </div>
                  </div>

                  {/* Unhide button */}
                  <button
                    onClick={() => unhidePlugin(plugin.id)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-dark hover:text-text border border-border hover:border-border-hover transition-all"
                    title="Unhide plugin"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Show
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
