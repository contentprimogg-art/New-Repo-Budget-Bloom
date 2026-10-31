import { ChevronDown, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney, fmtMonth, parseAmount } from '../lib/format'
import { useDataVersion } from '../lib/realtime'
import { supabase } from '../lib/supabase'
import { shiftMonth } from '../lib/types'
import ProgressBar from './ui/ProgressBar'
import SummaryColumns from './ui/SummaryColumns'

type Field = 'start_balance' | 'end_balance'

// Ligne « solde » du volet de détails: étiquette à gauche, saisie soulignée à droite.
function BalanceRow({
  label,
  value,
  saved,
  onSave,
  children,
}: {
  label: string
  value: string
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
    <li className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          {label}
          {saved && <span className="ml-2 text-xs font-medium text-accent-strong">{t('savedTick')}</span>}
        </span>
        <input
          inputMode="decimal"
          placeholder="—"
          aria-label={label}
          aria-invalid={invalid}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="field-line w-32 text-right tabular-nums"
        />
      </div>
      {children}
    </li>
  )
}

// Résumé du mois façon moodboard: SOLDE | BUDGÉTÉ | DÉPENSÉ, barre à rayures, « X restants sur Y »,
// puis un volet « Soldes et prévisions » (solde de début/fin, à répartir, solde estimé, écart).
export default function MonthSummary({
  householdId,
  month,
  totalBudget,
  totalSpent,
  totalIncome = 0,
  totalOver,
  overCount,
}: {
  householdId: string
  month: string
  totalBudget: number
  totalSpent: number
  totalIncome?: number
  totalOver: number
  overCount: number
}) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const version = useDataVersion()
  const money = (n: number) => fmtMoney(n, lng)
  const asField = (n: number | null) => (n == null ? '' : String(n).replace('.', lng.startsWith('fr') ? ',' : '.'))
  const [balances, setBalances] = useState<{ start: number | null; end: number | null }>({ start: null, end: null })
  const [prevEnd, setPrevEnd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<Field | null>(null)
  const [open, setOpen] = useState(false)
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
  }, [householdId, month, prevMonth, t, version])

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
  const left = totalBudget - totalSpent
  // Argent disponible ce mois-ci: solde de début + revenus (dès qu'au moins l'un des deux est connu).
  const available = start == null && totalIncome === 0 ? null : (start ?? 0) + totalIncome
  const toAllocate = available == null ? null : available - totalBudget
  const estimated = available == null ? null : available - totalSpent
  const gap = end != null && estimated != null ? end - estimated : null

  return (
    <section className="flex flex-col gap-4">
      <SummaryColumns
        items={[
          { label: t('colBalance'), value: start == null ? '—' : money(start), tone: 'var(--chart-2)' },
          { label: t('incomes'), value: money(totalIncome), tone: 'var(--ok)' },
          { label: t('spentShort'), value: money(totalSpent), tone: 'var(--accent-strong)', valueClassName: left < 0 ? 'text-over' : '' },
        ]}
      />
      <ProgressBar spent={totalSpent} budget={totalBudget} label={`${t('spent')} ${money(totalSpent)} / ${money(totalBudget)}`} />
      <p className="text-center text-sm">
        {left >= 0 ? (
          <>
            <span className="font-semibold text-ok-ink">{money(left)}</span> {t('leftOfBudgeted')} <span className="font-semibold">{money(totalBudget)}</span> {t('budgetedWord')}
          </>
        ) : (
          <span className="font-semibold text-over">{t('overBy', { amount: money(-left) })}</span>
        )}
      </p>
      {totalOver > 0 && (
        <p role="status" className="-mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-over">
          <TriangleAlert size={13} /> {t('overEnvelopes', { count: overCount, amount: money(totalOver) })}
        </p>
      )}

      <div className="no-print">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mx-auto flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {t('balancesAndForecast')}
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <ul className="fade-up mt-2 divide-y divide-dashed divide-muted/30">
            <BalanceRow label={t('startBalance')} value={asField(start)} saved={flash === 'start_balance'} onSave={save('start_balance')}>
              {start == null && prevEnd != null && (
                <button type="button" onClick={() => void save('start_balance')(String(prevEnd))} className="self-start text-xs text-accent-strong underline">
                  {t('reusePrev', { amount: money(prevEnd), month: fmtMonth(prevMonth, lng) })}
                </button>
              )}
            </BalanceRow>
            <BalanceRow label={t('endBalance')} value={asField(end)} saved={flash === 'end_balance'} onSave={save('end_balance')} />
            {toAllocate != null && (
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm" title={t('toAllocateHint')}>
                <span>
                  {t('toAllocate')}
                  <span className="block text-xs text-muted">{t('toAllocateHint')}</span>
                </span>
                <span className={`font-medium tabular-nums ${toAllocate < 0 ? 'text-over' : ''}`}>{money(toAllocate)}</span>
              </li>
            )}
            {estimated != null && (
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {t('estimatedBalance')}
                  <span className="block text-xs text-muted">{t('estimatedHint')}</span>
                </span>
                <span className="font-medium tabular-nums">{money(estimated)}</span>
              </li>
            )}
            {gap != null && (
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {t('balanceGap')}
                  <span className="block text-xs text-muted">{t('balanceGapHint')}</span>
                </span>
                <span className="font-medium tabular-nums">
                  {gap > 0 ? '+' : ''}
                  {money(gap)}
                </span>
              </li>
            )}
            {toAllocate != null && toAllocate < 0 && <li className="py-2 text-xs text-over">{t('overAllocatedBudget')}</li>}
          </ul>
        )}
      </div>
      {error && <p className="text-sm text-over">{error}</p>}
    </section>
  )
}
