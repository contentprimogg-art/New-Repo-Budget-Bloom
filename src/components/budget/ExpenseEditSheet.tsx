import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mutate } from '../../lib/expenses'
import { CURRENCIES, fmtMoney, getCurrency, parseAmount } from '../../lib/format'
import { fmtRate, getRate, roundMoney } from '../../lib/fx'
import { syncLinkedAmount } from '../../lib/savings'
import type { Envelope, Expense } from '../../lib/types'
import Select from '../Select'
import Field, { PRIMARY } from '../ui/Field'
import Sheet from '../ui/Sheet'

const asField = (n: number, lng: string) => {
  const text = String(n)
  return lng.startsWith('fr') ? text.replace('.', ',') : text
}

// Modification complète d'une dépense: libellé, montant et devise d'origine, taux, date, enveloppe.
export default function ExpenseEditSheet({
  expense,
  envelopes,
  onClose,
  onSaved,
}: {
  expense: Expense
  envelopes: Envelope[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const home = getCurrency()
  const startCurrency = expense.original_currency ?? home
  const startAmount = expense.original_currency && expense.original_amount != null ? Number(expense.original_amount) : expense.amount
  const startRate = startCurrency !== home && startAmount > 0 ? fmtRate(expense.amount / startAmount, lng) : ''
  const [note, setNote] = useState(expense.note ?? '')
  const [amount, setAmount] = useState(asField(startAmount, lng))
  const [currency, setCurrency] = useState(startCurrency)
  const [rate, setRate] = useState(startRate)
  const [rateState, setRateState] = useState<'idle' | 'looking' | 'missing'>('idle')
  const [date, setDate] = useState(expense.spent_on)
  const [envelopeId, setEnvelopeId] = useState(expense.envelope_id)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const foreign = currency !== home

  useEffect(() => {
    // La devise d'origine garde le taux de la dépense; une autre devise prend le taux du jour.
    if (!foreign || currency === startCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRate(foreign ? startRate : '')
      setRateState('idle')
      return
    }
    let alive = true
    setRate('')
    setRateState('looking')
    void getRate(currency, home).then((r) => {
      if (!alive) return
      setRateState(r ? 'idle' : 'missing')
      if (r) setRate(fmtRate(r.rate, lng))
    })
    return () => {
      alive = false
    }
  }, [currency, foreign, home, lng, startCurrency, startRate])

  const typed = parseAmount(amount)
  const rateValue = parseAmount(rate)
  const converted = foreign && typed > 0 && rateValue > 0 ? Math.max(roundMoney(typed * rateValue), 0.01) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const value = roundMoney(typed)
    if (!(value > 0)) return setError(t('errAmount'))
    if (foreign && converted === null) return setError(t('errRate'))
    if (!date) return setError(t('errGeneric'))
    const finalAmount = foreign ? converted! : value
    const values: Record<string, unknown> = { note: note.trim() || null, amount: finalAmount, spent_on: date, envelope_id: envelopeId }
    if (foreign) Object.assign(values, { original_amount: value, original_currency: currency })
    else if (expense.original_currency) Object.assign(values, { original_amount: null, original_currency: null })
    setBusy(true)
    const { error, queued } = await mutate({ kind: 'update', table: 'expenses', id: expense.id, values })
    if (!error && !queued) await syncLinkedAmount(expense.id, finalAmount)
    setBusy(false)
    if (error) return setError(`${t('errSave')} (${error})`)
    onSaved()
    onClose()
  }

  return (
    <Sheet title={t('editExpense')} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={t('colLabel')}>
          <input value={note} placeholder={t('transactionName')} onChange={(e) => setNote(e.target.value)} className="field-line" />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-3">
          <Field label={t('amount')} error={error}>
            <input inputMode="decimal" aria-invalid={!!error} value={amount} onChange={(e) => setAmount(e.target.value)} className="field-line text-lg tabular-nums" />
          </Field>
          <Select variant="field" label={t('currency')} value={currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={setCurrency} />
        </div>
        {foreign && (
          <div className="flex flex-col gap-1 text-sm">
            <label className="flex items-baseline gap-2 text-muted">
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
                ≈ {fmtMoney(converted, lng)} <span className="font-normal text-muted">{t('convertedNote')}</span>
              </p>
            )}
          </div>
        )}
        <Field label={t('date')}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-line" />
        </Field>
        {envelopes.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{t('chooseEnvelope')}</span>
            <Select variant="field" label={t('chooseEnvelope')} value={envelopeId} options={envelopes.map((x) => ({ value: x.id, label: x.name }))} onChange={setEnvelopeId} />
          </div>
        )}
        <button disabled={busy} className={PRIMARY}>
          {t('save')}
        </button>
      </form>
    </Sheet>
  )
}
