import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mutate } from '../../lib/expenses'
import { CURRENCIES, defaultDateFor, fmtMoney, getCurrency, parseAmount } from '../../lib/format'
import { fmtRate, getRate, roundMoney } from '../../lib/fx'
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
  // Dépense dans une autre devise (voyage…): convertie dans la devise du foyer au taux du jour, modifiable.
  const home = getCurrency()
  const [currency, setCurrency] = useState(home)
  const [rate, setRate] = useState('')
  const [rateState, setRateState] = useState<'idle' | 'looking' | 'missing'>('idle')
  const foreign = currency !== home

  useEffect(() => {
    if (!foreign) return
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRateState('looking')
    setRate('')
    void getRate(currency, home).then((r) => {
      if (!alive) return
      setRateState(r ? 'idle' : 'missing')
      if (r) setRate(fmtRate(r.rate, i18n.language))
    })
    return () => {
      alive = false
    }
  }, [currency, home, foreign, i18n.language])

  const typed = parseAmount(amount)
  const rateValue = parseAmount(rate)
  const converted = foreign && typed > 0 && rateValue > 0 ? roundMoney(typed * rateValue) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !envelope) return
    const value = roundMoney(typed)
    if (!(value > 0)) return setError(t('errAmount'))
    if (foreign && !(rateValue > 0)) return setError(t('errRate'))
    const row = {
      id: uuid(),
      household_id: envelope.household_id,
      envelope_id: envelope.id,
      amount: foreign ? Math.max(roundMoney(value * rateValue), 0.01) : value,
      note: note.trim() || null,
      spent_on: date || defaultDateFor(envelope.month),
      ...(foreign ? { original_amount: value, original_currency: currency } : {}),
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
    if (result.error) return setError(/original_/.test(result.error) ? t('errMigration0009') : `${t('errSave')} (${result.error})`)
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
            <div className="w-24 shrink-0">
              <Select
                label={t('currency')}
                value={currency}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                onChange={setCurrency}
                className="text-lg text-muted"
              />
            </div>
          </div>
          {foreign && (
            <div className="-mt-2 flex flex-col items-center gap-1 text-sm">
              <label className="flex items-baseline gap-1.5 text-muted">
                <span>1 {currency} =</span>
                <input
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder={rateState === 'looking' ? '…' : '0,00'}
                  aria-label={t('exchangeRate')}
                  className="field-line w-24 text-center tabular-nums"
                />
                <span>{home}</span>
              </label>
              {rateState === 'missing' && <p className="text-xs text-muted">{t('rateMissing')}</p>}
              {converted !== null && (
                <p className="font-medium">
                  ≈ {fmtMoney(converted, i18n.language)} <span className="font-normal text-muted">{t('convertedNote')}</span>
                </p>
              )}
            </div>
          )}

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
