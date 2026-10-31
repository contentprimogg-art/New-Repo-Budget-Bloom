import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import ScriptTitle from '../ScriptTitle'

// Panneau qui monte du bas de l'écran (fenêtre centrée sur ordinateur).
export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-4xl bg-surface px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-xl sm:rounded-4xl sm:pb-6"
      >
        <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between gap-3">
          <ScriptTitle as="h2">{title}</ScriptTitle>
          <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-full p-2 text-muted hover:bg-accent-soft">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
