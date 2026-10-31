import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mutate } from '../../lib/expenses'
import { currencySymbol, defaultDateFor, parseAmount } from '../../lib/format'
import { IconGlyph } from '../../lib/icons'
import { FREQUENCIES, makeRecurring, type Frequency } from '../../lib/recurring'
import type { Envelope } from '../../lib/types'
import { uuid } from '../../lib/uuid'
import Select from '../Select'
import Field, { PRIMARY } from '../ui/Field'
import Sheet from '../ui/Sheet'

// Ajout rapide d'une dépense (bouton « + »): montant en grand, choix de l'enveloppe dans une
// grille d'icônes colorées (comme la grille de catégories du moodboard), libellé et date.
export default function QuickAddSheet({
  envelopes,
  defaultEnvelopeId,
  onClose,
  onAdded,
}: {
  envelopes: Envelope[]
  defaultEnvelopeId?: string
  onClose: () => void
  onAdded: (queued: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const [envelopeId, setEnvelopeId] = useState(defaultEnvelopeId ?? envelopes[0]?.id ?? '')
  const envelope = envelopes.find((e) => e.id === envelopeId)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(envelope ? defaultDateFor(envelope.month) : '')
  const [repeat, setRepeat] = useState<'none' | `${Frequency}`>('none')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !envelope) return
    const value = Math.round(parseAmount(amount) * 100) / 100
    if (!(value > 0)) return setError(t('errAmount'))
    const row = {
      id: uuid(),
      household_id: envelope.household_id,
      envelope_id: envelope.id,
      amount: value,
      note: note.trim() || null,
      spent_on: date || defaultDateFor(envelope.month),
    }
    // Une dépense récurrente crée aussi son modèle côté serveur: elle demande donc le réseau.
    if (repeat !== 'none' && !navigator.onLine) return setError(t('repeatNeedsNetwork'))
    setBusy(true)
    const result = await mutate({ kind: 'insert', table: 'expenses', row })
    if (!result.error && repeat !== 'none') {
      const r = await makeRecurring({ envelope, expense: row, every: Number(repeat) as Frequency })
      if (r.error) {
        setBusy(false)
        return setError(/recurring_expenses/.test(r.error) ? t('errMigration0008') : `${t('errSave')} (${r.error})`)
      }
    }
    setBusy(false)
    if (result.error) return setError(`${t('errSave')} (${result.error})`)
    onAdded(result.queued)
    onClose()
  }

  return (
    <Sheet title={t('newExpense')} onClose={onClose}>
      {envelopes.length === 0 ? (
        <p className="text-sm text-muted">{t('noEnvelopes')}</p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="flex items-baseline justify-center gap-2">
            <input
              autoFocus
              inputMode="decimal"
              placeholder="0,00"
              aria-label={t('amount')}
              aria-invalid={!!error}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="field-line w-44 text-center text-4xl font-medium tabular-nums"
            />
            <span className="text-2xl text-muted">{currencySymbol(i18n.language)}</span>
          </div>

          <div role="radiogroup" aria-label={t('chooseEnvelope')} className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto">
            {envelopes.map((env) => {
              const selected = env.id === envelopeId
              return (
                <button
                  key={env.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setEnvelopeId(env.id)
                    setDate((d) => d || defaultDateFor(env.month))
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center ${selected ? 'bg-accent-soft ring-1 ring-accent' : 'hover:bg-accent-soft/50'}`}
                >
                  <IconGlyph icon={env.icon} color={env.color} size={26} />
                  <span className="line-clamp-2 text-[11px] leading-tight">{env.name}</span>
                </button>
              )
            })}
          </div>

          <Field label={t('colLabel')}>
            <input placeholder={t('transactionName')} value={note} onChange={(e) => setNote(e.target.value)} className="field-line" />
          </Field>
          <Field label={t('date')}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-line" />
          </Field>
          <Field label={t('repeat')}>
            <Select
              variant="field"
              label={t('repeat')}
              value={repeat}
              options={[
                { value: 'none' as const, label: t('repeatNone') },
                ...FREQUENCIES.map((f) => ({ value: `${f}` as const, label: t(`repeat_${f}`) })),
              ]}
              onChange={setRepeat}
            />
          </Field>
          {error && <p className="text-sm text-over">{error}</p>}
          <button disabled={busy} className={PRIMARY}>
            {t('addExpense')}
          </button>
        </form>
      )}
    </Sheet>
  )
}
