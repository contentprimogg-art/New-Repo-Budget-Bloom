import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { emojiTints } from '../../lib/color'
import { mutate } from '../../lib/expenses'
import { currencySymbol, defaultDateFor, parseAmount } from '../../lib/format'
import type { Income } from '../../lib/types'
import { uuid } from '../../lib/uuid'
import ConfirmButton from '../ConfirmButton'
import Field, { PRIMARY } from '../ui/Field'
import Sheet from '../ui/Sheet'

export const INCOME_EMOJIS = ['💶', '💼', '🏦', '🎁', '💸', '🪙', '🏠', '🧾', '🛍️', '❤️']

// Saisie d'un revenu (salaire, prime, remboursement, vente…), récurrent chaque mois ou non.
// Fonctionne hors-ligne: l'enregistrement est mis en attente et envoyé au retour du réseau.
export default function IncomeSheet({
  householdId,
  month,
  income,
  onClose,
  onSaved,
}: {
  householdId: string
  month: string
  income?: Income
  onClose: () => void
  onSaved: (queued: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const [label, setLabel] = useState(income?.label ?? '')
  const [amount, setAmount] = useState(income ? String(income.amount).replace('.', ',') : '')
  const [date, setDate] = useState(income?.received_on ?? defaultDateFor(month))
  const [recurring, setRecurring] = useState(income?.recurring ?? true)
  const [icon, setIcon] = useState(income?.icon ?? '💶')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const value = Math.round(parseAmount(amount) * 100) / 100
    if (!label.trim()) return setError(t('errNameRequired'))
    if (!(value > 0)) return setError(t('errAmount'))
    setBusy(true)
    const values = { label: label.trim(), amount: value, received_on: date || defaultDateFor(month), recurring, icon, color: emojiTints(icon)[0] }
    const result = income
      ? await mutate({ kind: 'update', table: 'incomes', id: income.id, values })
      : await mutate({ kind: 'insert', table: 'incomes', row: { ...values, id: uuid(), household_id: householdId, month } })
    setBusy(false)
    if (result.error) return setError(/incomes/.test(result.error) ? t('errMigration0008') : `${t('errSave')} (${result.error})`)
    onSaved(result.queued)
    onClose()
  }

  async function remove() {
    if (!income) return
    const result = await mutate({ kind: 'delete', table: 'incomes', id: income.id })
    if (result.error) return setError(`${t('errSave')} (${result.error})`)
    onSaved(result.queued)
    onClose()
  }

  return (
    <Sheet title={income ? t('editIncome') : t('newIncome')} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex items-baseline justify-center gap-2">
          <input
            autoFocus={!income}
            inputMode="decimal"
            placeholder="0,00"
            aria-label={t('amount')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field-line w-44 text-center text-4xl font-medium tabular-nums"
          />
          <span className="text-2xl text-muted">{currencySymbol(i18n.language)}</span>
        </div>
        <Field label={t('colLabel')}>
          <input placeholder={t('incomePlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} className="field-line text-base" />
        </Field>
        <div role="radiogroup" aria-label={t('chooseIcon')} className="flex flex-wrap gap-1.5">
          {INCOME_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              role="radio"
              aria-checked={icon === em}
              onClick={() => setIcon(em)}
              className={`emoji grid size-10 place-items-center rounded-2xl text-xl ${icon === em ? 'bg-accent-soft ring-2 ring-accent-strong' : 'hover:bg-accent-soft/60'}`}
            >
              {em}
            </button>
          ))}
        </div>
        <Field label={t('date')}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-line" />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="size-4" />
          {t('incomeRecurring')}
        </label>
        {error && <p className="text-sm text-over">{error}</p>}
        <button disabled={busy} className={PRIMARY}>
          {income ? t('save') : t('addIncome')}
        </button>
        {income && (
          <ConfirmButton
            label={t('delete')}
            confirmLabel={t('confirmDelete')}
            onConfirm={() => void remove()}
            className="self-center text-sm text-muted underline"
            confirmClassName="self-center text-sm font-semibold text-over underline"
          />
        )}
      </form>
    </Sheet>
  )
}
