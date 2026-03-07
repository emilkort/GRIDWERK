import { useState } from 'react'
import { useCollectionStore, type Collection } from '@/stores/collection.store'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const TYPE_CONFIG = {
  album:    { label: 'Album',    color: '#8b5cf6' },
  ep:       { label: 'EP',       color: '#f97316' },
  single:   { label: 'Single',   color: '#22c55e' },
  playlist: { label: 'Playlist', color: '#3b82f6' }
} as const

export default function CollectionList() {
  const { collections, selectedCollectionId, selectCollection, createCollection, deleteCollection } = useCollectionStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'album' | 'ep' | 'single' | 'playlist'>('album')
  const [confirmDelete, setConfirmDelete] = useState<Collection | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    const collection = await createCollection({ name: newName.trim(), type: newType })
    setNewName('')
    setShowCreate(false)
    selectCollection(collection.id)
  }

  const grouped = {
    album: collections.filter(c => c.type === 'album'),
    ep: collections.filter(c => c.type === 'ep'),
    single: collections.filter(c => c.type === 'single'),
    playlist: collections.filter(c => c.type === 'playlist')
  }

  return (
    <div className="w-56 bg-base border-r border-border flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">Collections</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1 text-text-dark hover:text-text transition-colors"
          title="New collection"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-3 py-3 border-b border-border space-y-2 bg-surface">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false) }}
            placeholder="Collection name..."
            className="w-full bg-base border border-border rounded px-2.5 py-1.5 text-text text-[12px] focus:outline-none focus:border-text-muted"
          />
          <div className="flex gap-1">
            {(Object.keys(TYPE_CONFIG) as (keyof typeof TYPE_CONFIG)[]).map(t => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-all"
                style={newType === t
                  ? { backgroundColor: `${TYPE_CONFIG[t].color}22`, color: TYPE_CONFIG[t].color, border: `1px solid ${TYPE_CONFIG[t].color}55` }
                  : { backgroundColor: '#1a1a1a', color: '#555', border: '1px solid transparent' }
                }
              >
                {TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 text-[10px] font-bold text-text bg-white/10 hover:bg-white/15 px-2 py-1.5 transition-colors">
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="text-[10px] text-text-dark hover:text-text px-2 py-1.5 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Collection list */}
      <div className="flex-1 overflow-y-auto py-2">
        {collections.length === 0 && !showCreate && (
          <div className="px-4 py-8 text-center">
            <p className="text-text-darker text-[11px]">No collections yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 text-[10px] text-accent hover:text-text font-bold transition-colors"
            >
              Create your first album
            </button>
          </div>
        )}

        {(Object.entries(grouped) as [keyof typeof TYPE_CONFIG, Collection[]][]).map(([type, items]) =>
          items.length > 0 && (
            <div key={type} className="mb-1">
              <div className="px-4 py-1.5">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em]" style={{ color: TYPE_CONFIG[type].color + '80' }}>
                  {TYPE_CONFIG[type].label}s
                </span>
              </div>
              {items.map(c => {
                const isSelected = selectedCollectionId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCollection(c.id)}
                    onContextMenu={e => { e.preventDefault(); setConfirmDelete(c) }}
                    className={`group w-full text-left px-4 py-2 flex items-center gap-2.5 transition-all ${
                      isSelected ? 'bg-white/5 text-text' : 'text-text-secondary hover:text-text hover:bg-surface'
                    }`}
                  >
                    {/* Album art thumbnail or color dot */}
                    {c.artwork_path ? (
                      <img
                        src={`file://${c.artwork_path}`}
                        alt=""
                        className="w-7 h-7 object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: (c.color || TYPE_CONFIG[type].color) + '20' }}
                      >
                        <span className="text-[10px] font-bold" style={{ color: c.color || TYPE_CONFIG[type].color }}>
                          {c.item_count}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold truncate">{c.name}</p>
                      <p className="text-[9px] text-text-dark">
                        {c.item_count} track{c.item_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="w-[2px] h-4 bg-accent absolute left-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Collection"
        message={`Delete "${confirmDelete?.name}"? Songs won't be deleted.`}
        confirmLabel="Delete"
        onConfirm={async () => { if (confirmDelete) await deleteCollection(confirmDelete.id); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
