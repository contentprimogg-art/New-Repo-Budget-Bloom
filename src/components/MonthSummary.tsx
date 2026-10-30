import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney, parseAmount } from '../lib/format'
import { supabase } from '../lib/supabase'

type Field = 'start_balance' | 'end_balance'

// Champ de solde: valide au blur ou sur Entrée, vide = pas de solde renseigné.
function BalanceField({
  label,
  value,
  onSave,
}: {
  label: string
  value: string
  onSave: (raw: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState(value)
  const saved = useRef(value)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    // La valeur arrive après le chargement asynchrone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value)
    saved.current = value
  }, [value])

  async function commit() {
    if (draft === saved.current) return
    const ok = await onSave(draft)
    setInvalid(!ok)
    if (ok) saved.current = draft
  }

  return (
    <label className="flex flex-1 flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input
        inputMode="decimal"
        placeholder="0,00"
        aria-label={label}
        aria-invalid={invalid}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 tabular-nums"
      />
    </label>
  )
}

export default function MonthSummary({
  householdId,
  month,
  totalBudget,
  totalSpent,
  totalOver,
}: {
  householdId: string
  month: string
  totalBudget: number
  totalSpent: number
  totalOver: number
}) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const [balances, setBalances] = useState<Record<Field, string>>({ start_balance: '', end_balance: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('month_balances')
      .select('start_balance, end_balance')
      .eq('household_id', householdId)
      .eq('month', month)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return setError(`${t('errLoad')} (${error.message})`)
        setBalances({
          start_balance: data?.start_balance == null ? '' : String(data.start_balance),
          end_balance: data?.end_balance == null ? '' : String(data.end_balance),
        })
      })
  }, [householdId, month, t])

  const save = (field: Field) => async (raw: string) => {
    const value = raw.trim() === '' ? null : parseAmount(raw)
    if (value !== null && !Number.isFinite(value)) {
      setError(t('errAmount'))
      return false
    }
    const { error } = await supabase
      .from('month_balances')
      .upsert({ household_id: householdId, month, [field]: value }, { onConflict: 'household_id,month' })
    if (error) {
      setError(`${t('errSave')} (${error.message})`)
      return false
    }
    setError(null)
    return true
  }

  const remaining = totalBudget - totalSpent
  const stats: [string, string, boolean][] = [
    [t('budgeted'), money(totalBudget), false],
    [t('spent'), money(totalSpent), false],
    [t('remaining'), money(Math.max(remaining, 0)), false],
  ]

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted">{label}</dt>
            <dd className="text-base font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {totalOver > 0 && (
        <p role="status" className="rounded-xl bg-over/10 px-3 py-2 text-sm font-semibold text-over">
          {t('totalOver', { amount: money(totalOver) })}
        </p>
      )}
      <div className="flex gap-3">
        <BalanceField label={t('startBalance')} value={balances.start_balance} onSave={save('start_balance')} />
        <BalanceField label={t('endBalance')} value={balances.end_balance} onSave={save('end_balance')} />
      </div>
      {error && <p className="text-sm text-over">{error}</p>}
    </section>
  )
}
