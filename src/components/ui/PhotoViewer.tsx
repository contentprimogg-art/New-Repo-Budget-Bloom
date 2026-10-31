import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

// Photo de profil en grand, avec téléchargement.
export default function PhotoViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [error, setError] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function download() {
    try {
      const blob = await fetch(url).then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.blob()
      })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = 'budget-bloom-photo.jpg'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch {
      setError(true)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('profilePhoto')}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-text/80 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <button onClick={onClose} aria-label={t('close')} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full bg-surface/15 p-2 text-white">
        <X size={22} />
      </button>
      <img src={url} alt={t('profilePhoto')} className="fade-up max-h-[70dvh] w-full max-w-md rounded-4xl object-cover shadow-2xl" />
      <button onClick={() => void download()} className="flex items-center gap-2 rounded-full bg-surface px-5 py-2.5 font-medium text-text">
        <Download size={17} /> {t('downloadPhoto')}
      </button>
      {error && <p className="text-sm text-white">{t('errGeneric')}</p>}
    </div>,
    document.body,
  )
}
