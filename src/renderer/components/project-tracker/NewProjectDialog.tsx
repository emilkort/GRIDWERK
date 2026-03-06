import { useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useProjectStore } from '@/stores/project.store'
import { useStageStore } from '@/stores/stage.store'

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', color: '#f87171' },
  { value: 'high',   label: 'High',   color: '#fb923c' },
  { value: 'normal', label: 'Normal', color: '#6b7280' },
  { value: 'low',    label: 'Low',    color: '#60a5fa' }
]

interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
  initialStage?: string
}

const COLOR_SWATCHES = [
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Red' }
]

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const SCALES = ['Major', 'Minor']

function buildMusicalKeys(): string[] {
  const keys: string[] = []
  for (const note of NOTES) {
    for (const scale of SCALES) {
      keys.push(`${note} ${scale}`)
    }
  }
  return keys
}

const MUSICAL_KEYS = buildMusicalKeys()

export default function NewProjectDialog({ open, onClose, initialStage }: NewProjectDialogProps) {
  const createProject = useProjectStore((s) => s.createProject)
  const stages = useStageStore((s) => s.stages)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stage, setStage] = useState(initialStage || 'idea')
  const [bpm, setBpm] = useState('')
  const [musicalKey, setMusicalKey] = useState('')
  const [color, setColor] = useState('#8b5cf6')
  const [priority, setPriority] = useState('normal')
  const [saving, setSaving] = useState(false)

  // Sync stage when initialStage changes (e.g. quick-add from column)
  const prevInitialStage = useRef(initialStage)
  if (open && initialStage && initialStage !== prevInitialStage.current) {
    setStage(initialStage)
    prevInitialStage.current = initialStage
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await createProject({
        title: title.trim(),
        description: description.trim() || undefined,
        stage,
        bpm: bpm ? Number(bpm) : undefined,
        musicalKey: musicalKey || undefined,
        color,
        priority
      })
      resetForm()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setStage(initialStage || 'idea')
    setBpm('')
    setMusicalKey('')
    setColor('#8b5cf6')
    setPriority('normal')
    prevInitialStage.current = initialStage
  }

  const isValid = title.trim().length > 0

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-base/60 z-50" />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base border border-border p-8 w-[480px] max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/90 focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
        <h3 className="text-text font-bold text-[13px] tracking-[0.2em] uppercase mb-6">New Project</h3>

        {/* Title */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summer Vibes"
            className="w-full bg-surface border border-border px-4 py-2.5 text-text text-[12px] placeholder-text-secondary focus:outline-none focus:border-text transition-all"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief notes about this project..."
            rows={3}
            className="w-full bg-surface border border-border px-4 py-2.5 text-text text-[12px] placeholder-text-secondary focus:outline-none focus:border-text transition-all resize-none"
          />
        </div>

        {/* Stage */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">Stage</label>
          <div className="flex gap-2">
            {stages.map((s) => (
              <button
                key={s.slug}
                onClick={() => setStage(s.slug)}
                className={`flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-all duration-200 border ${
                  stage === s.slug
                    ? 'border-accent bg-transparent text-accent'
                    : 'border-transparent bg-elevated text-text-dark hover:text-text'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* BPM & Key row */}
        <div className="flex gap-5 mb-5">
          {/* BPM */}
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">BPM</label>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              placeholder="120"
              min={20}
              max={300}
              className="w-full bg-surface border border-border px-4 py-2.5 text-text text-[12px] placeholder-text-secondary focus:outline-none focus:border-text transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Musical Key */}
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">Key</label>
            <select
              value={musicalKey}
              onChange={(e) => setMusicalKey(e.target.value)}
              className="w-full bg-surface border border-border px-4 py-2.5 text-text text-[12px] focus:outline-none focus:border-text transition-all appearance-none cursor-pointer"
            >
              <option value="" className="text-[#b3b3b3]">
                Select key...
              </option>
              {MUSICAL_KEYS.map((key) => (
                <option key={key} value={key} className="text-text">
                  {key}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPriority(p.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-all duration-200 border ${
                  priority === p.value
                    ? 'border-transparent text-white'
                    : 'border-transparent bg-elevated text-text-secondary hover:text-text'
                }`}
                style={priority === p.value ? { backgroundColor: p.color + '28', borderColor: p.color + '60', color: p.color } : {}}
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="mb-8">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">Color Label</label>
          <div className="flex gap-3">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch.value}
                onClick={() => setColor(swatch.value)}
                className={`w-8 h-8 transition-all duration-200 ${
                  color === swatch.value
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: swatch.value }}
                title={swatch.label}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 text-[10px] font-bold text-text-muted hover:text-text transition-colors uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="px-6 py-2.5 bg-accent hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-bold uppercase tracking-widest transition-all duration-300"
          >
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
