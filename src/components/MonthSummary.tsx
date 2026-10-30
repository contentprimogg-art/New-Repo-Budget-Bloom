import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney, fmtMonth, parseAmount } from '../lib/format'
import { supabase } from '../lib/supabase'
import { shiftMonth } from '../lib/types'

type Field = 'start_balance' | 'end_balance'

// Champ de solde: valide au blur ou sur Entrée, vide = pas de solde renseigné.
function BalanceField({
  label,
  value,
  saved,
  onSave,
  children,
}: {
  label: string
  value: string
  /** Vrai un court instant après un enregistrement réussi. */
  saved: boolean
  onSave: (raw: string) => Promise<boolean>
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  const committed = useRef(value)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    // La valeur arrive après le chargement asynchrone, ou change après un « Reprendre ».
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value)
    committed.current = value
  }, [value])

  async function commit() {
    if (draft === committed.current) return
    const ok = await onSave(draft)
    setInvalid(!ok)
    if (ok) committed.current = draft
  }

  return (
    <div className="flex flex-1 flex-col gap-1 text-sm">
      <label className="flex items-center justify-between gap-2">
        <span className="text-muted">{label}</span>
        {saved && <span className="text-xs font-medium text-accent-strong">{t('savedTick')}</span>}
      </label>
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
        className="w-full rounded-2xl border border-border bg-surface px-3 py-2 tabular-nums"
      />
      {children}
    </div>
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
  const lng = i18n.language
  const money = (n: number) => fmtMoney(n, lng)
  const asField = (n: number | null) => (n == null ? '' : String(n).replace('.', lng.startsWith('fr') ? ',' : '.'))
  const [balances, setBalances] = useState<{ start: number | null; end: number | null }>({ start: null, end: null })
  const [prevEnd, setPrevEnd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<Field | null>(null)
  const prevMonth = shiftMonth(month, -1)

  useEffect(() => {
    void supabase
      .from('month_balances')
      .select('month, start_balance, end_balance')
      .eq('household_id', householdId)
      .in('month', [month, prevMonth])
      .then(({ data, error }) => {
        if (error) return setError(`${t('errLoad')} (${error.message})`)
        const num = (v: unknown) => (v == null ? null : Number(v))
        const current = data?.find((r) => r.month === month)
        setBalances({ start: num(current?.start_balance), end: num(current?.end_balance) })
        setPrevEnd(num(data?.find((r) => r.month === prevMonth)?.end_balance))
      })
  }, [householdId, month, prevMonth, t])

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
    setBalances((b) => ({ ...b, [field === 'start_balance' ? 'start' : 'end']: value }))
    setFlash(field)
    setTimeout(() => setFlash((f) => (f === field ? null : f)), 2500)
    return true
  }

  const { start, end } = balances
  const remaining = totalBudget - totalSpent
  const toAllocate = start == null ? null : start - totalBudget
  const estimated = start == null ? null : start - totalSpent
  const gap = end != null && estimated != null ? end - estimated : null

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-4 shadow-sm">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {(
          [
            [t('budgeted'), totalBudget],
            [t('spent'), totalSpent],
            [t('remaining'), Math.max(remaining, 0)],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted">{label}</dt>
            <dd className="text-base font-semibold tabular-nums">{money(value)}</dd>
          </div>
        ))}
      </dl>
      {totalOver > 0 && (
        <p role="status" className="rounded-2xl bg-over/10 px-3 py-2 text-sm font-semibold text-over">
          {t('totalOver', { amount: money(totalOver) })}
        </p>
      )}

      <div className="flex gap-3">
        <BalanceField
          label={t('startBalance')}
          value={asField(start)}
          saved={flash === 'start_balance'}
          onSave={save('start_balance')}
        >
          {start == null && prevEnd != null && (
            <button
              type="button"
              onClick={() => void save('start_balance')(String(prevEnd)).then((ok) => ok && setBalances((b) => ({ ...b, start: prevEnd })))}
              className="text-left text-xs text-accent-strong underline"
            >
              {t('reusePrev', { amount: money(prevEnd), month: fmtMonth(prevMonth, lng) })}
            </button>
          )}
        </BalanceField>
        <BalanceField label={t('endBalance')} value={asField(end)} saved={flash === 'end_balance'} onSave={save('end_balance')} />
      </div>

      {/* Les soldes se combinent avec les enveloppes. */}
      {toAllocate != null && estimated != null && (
        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-accent-soft/50 p-3 text-sm">
          <div title={t('toAllocateHint')}>
            <dt className="text-muted">{t('toAllocate')}</dt>
            <dd className={`text-base font-semibold tabular-nums ${toAllocate < 0 ? 'text-over' : ''}`}>
              {money(toAllocate)}
            </dd>
          </div>
          <div title={t('estimatedHint')}>
            <dt className="text-muted">{t('estimatedBalance')}</dt>
            <dd className="text-base font-semibold tabular-nums">{money(estimated)}</dd>
          </div>
          {toAllocate < 0 && <p className="col-span-2 text-xs text-over">{t('overAllocatedBudget')}</p>}
          {gap != null && (
            <p className="col-span-2 text-xs text-muted">
              {t('balanceGap')}: <span className="font-medium tabular-nums text-text">{gap > 0 ? '+' : ''}{money(gap)}</span> · {t('balanceGapHint')}
            </p>
          )}
        </dl>
      )}
      {error && <p className="text-sm text-over">{error}</p>}
    </section>
  )
}
