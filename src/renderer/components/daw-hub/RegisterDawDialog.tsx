import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useDawStore } from '@/stores/daw.store'

interface RegisterDawDialogProps {
  open: boolean
  onClose: () => void
}

const PRESETS: Record<string, { extension: string }> = {
  'Ableton Live': { extension: '.als' },
  'Maschine': { extension: '.mxprj' },
  'FL Studio': { extension: '.flp' },
  'Logic Pro': { extension: '.logicx' },
  'Bitwig Studio': { extension: '.bwproject' },
  'Studio One': { extension: '.song' },
  'Reaper': { extension: '.rpp' },
  'Cubase': { extension: '.cpr' },
  'Pro Tools': { extension: '.ptx' }
}

export default function RegisterDawDialog({ open, onClose }: RegisterDawDialogProps) {
  const registerDaw = useDawStore((s) => s.registerDaw)

  const [name, setName] = useState('')
  const [executablePath, setExecutablePath] = useState('')
  const [projectExtension, setProjectExtension] = useState('')
  const [projectFolders, setProjectFolders] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const handlePresetSelect = (presetName: string) => {
    setName(presetName)
    const preset = PRESETS[presetName]
    if (preset) {
      setProjectExtension(preset.extension)
    }
  }

  const handlePickExecutable = async () => {
    const filePath = await window.api.dialog.pickFile([
      { name: 'Executables', extensions: ['exe', 'app', ''] }
    ])
    if (filePath) {
      setExecutablePath(filePath)
    }
  }

  const handleAddFolder = async () => {
    const folderPath = await window.api.dialog.pickFolder()
    if (folderPath && !projectFolders.includes(folderPath)) {
      setProjectFolders([...projectFolders, folderPath])
    }
  }

  const handleRemoveFolder = (index: number) => {
    setProjectFolders(projectFolders.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!name.trim() || !executablePath.trim() || !projectExtension.trim()) return
    setSaving(true)
    try {
      await registerDaw({
        name: name.trim(),
        executablePath: executablePath.trim(),
        projectExtension: projectExtension.trim(),
        projectFolders
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
    setName('')
    setExecutablePath('')
    setProjectExtension('')
    setProjectFolders([])
  }

  const isValid = name.trim() && executablePath.trim() && projectExtension.trim()

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-base/60 z-50" />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base border border-border p-8 w-[520px] max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/90 focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
        <h3 className="text-text font-bold text-[13px] tracking-[0.2em] uppercase mb-6">Register DAW</h3>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">DAW Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              const preset = PRESETS[e.target.value]
              if (preset) {
                setProjectExtension(preset.extension)
              }
            }}
            placeholder="e.g. Ableton Live"
            className="w-full bg-surface border border-border px-4 py-2.5 text-text text-[12px] placeholder-text-secondary focus:outline-none focus:border-text transition-all"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.keys(PRESETS).map((presetName) => (
              <button
                key={presetName}
                onClick={() => handlePresetSelect(presetName)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors border ${
                  name === presetName
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent text-text-dark hover:text-text border-border hover:border-border-hover'
                }`}
              >
                {presetName}
              </button>
            ))}
          </div>
        </div>

        {/* Executable Path */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">Executable Path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={executablePath}
              onChange={(e) => setExecutablePath(e.target.value)}
              placeholder="Path to DAW executable..."
              className="flex-1 bg-surface border border-border px-4 py-2.5 text-text text-[12px] placeholder-text-secondary focus:outline-none transition-all"
              readOnly
            />
            <button
              onClick={handlePickExecutable}
              className="px-4 py-2.5 bg-transparent border border-border text-text font-bold uppercase tracking-widest hover:border-border-hover text-[10px] transition-all shrink-0"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Project Extension */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">Project File Extension</label>
          <input
            type="text"
            value={projectExtension}
            onChange={(e) => setProjectExtension(e.target.value)}
            placeholder=".als"
            className="w-full bg-surface border border-border px-4 py-2.5 text-text text-[12px] placeholder-text-secondary focus:outline-none focus:border-text transition-all"
          />
        </div>

        {/* Project Folders */}
        <div className="mb-8">
          <label className="block text-[11px] font-bold text-text-dark uppercase tracking-widest mb-2">Project Folders</label>
          {projectFolders.length > 0 && (
            <div className="space-y-2 mb-3">
              {projectFolders.map((folder, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-surface border border-border px-4 py-3"
                >
                  <svg className="w-4 h-4 text-text-dark shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-sm text-text font-bold truncate flex-1" title={folder}>
                    {folder}
                  </span>
                  <button
                    onClick={() => handleRemoveFolder(index)}
                    className="p-1 text-text-dark hover:text-accent transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleAddFolder}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-dashed border-border text-text-dark hover:text-text hover:border-border-hover font-bold uppercase tracking-widest text-[10px] transition-all w-full"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Folder
          </button>
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
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
