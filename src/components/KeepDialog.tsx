import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { childrenOf, useSavings } from '../lib/savings'

// « Où mettre cette somme de côté ? » : choix de l'enveloppe d'épargne à créditer.
export default function KeepDialog({
  householdId,
  onChoose,
  onCancel,
}: {
  householdId: string
  onChoose: (savingsId: string | null) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { data, loaded } = useSavings(householdId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const options: { id: string; label: string; child: boolean }[] = []
  if (data) {
    for (const top of data.envelopes.filter((e) => !e.parent_id)) {
      options.push({ id: top.id, label: top.name, child: false })
      for (const c of childrenOf(data, top.id)) options.push({ id: c.id, label: c.name, child: true })
    }
  }

  const item = 'w-full rounded-xl border border-border px-4 py-2.5 text-left hover:border-accent hover:bg-accent-soft/50'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div role="dialog" aria-modal="true" aria-label={t('keepTitle')} className="fade-up flex max-h-[80dvh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{t('keepTitle')}</h2>
        <p className="text-sm text-muted">{t('keepHint')}</p>
        {!loaded && <p className="text-sm text-muted">{t('loading')}</p>}
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <button key={o.id} autoFocus={options[0]?.id === o.id} onClick={() => onChoose(o.id)} className={`${item} ${o.child ? 'ml-5 w-[calc(100%-1.25rem)] text-sm' : 'font-medium'}`}>
              {o.child && <span aria-hidden className="mr-1.5 text-muted">↳</span>}
              {o.label}
            </button>
          ))}
          {loaded && options.length === 0 && <p className="text-sm text-muted">{t('keepNone')}</p>}
          <button onClick={() => onChoose(null)} className={`${item} text-muted`}>
            {t('keepNoEnvelope')}
          </button>
        </div>
        <button onClick={onCancel} className="self-end text-sm text-muted underline">
          {t('cancel')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
