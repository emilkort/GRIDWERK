import * as AlertDialog from '@radix-ui/react-alert-dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-base/60 z-50" />
        <AlertDialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base border border-border p-8 w-96 shadow-2xl shadow-black/90 focus:outline-none">
          <AlertDialog.Title className="text-text font-bold text-[12px] tracking-[0.2em] uppercase mb-3">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-text-muted text-[11px] mb-8 leading-relaxed tracking-wider">
            {message}
          </AlertDialog.Description>
          <div className="flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button
                onClick={onCancel}
                className="px-5 py-2 text-[10px] font-bold text-text-muted hover:text-text transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="btn-primary"
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
