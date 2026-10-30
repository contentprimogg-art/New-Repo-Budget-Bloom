import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadFile, openMailDraft, shareFile } from '../lib/files'
import { fmtDate, fmtMonth, fmtMoney, todayIso } from '../lib/format'
import {
  buildBackup,
  buildCsv,
  envelopeMatrix,
  listMonths,
  loadStats,
  monthTotals,
  spentOf,
  weeklyMatrix,
  type Balance,
  type StatEnvelope,
} from '../lib/stats'
import type { Tip } from '../lib/tips'
import GroupedBars from './GroupedBars'
import AvatarLink from './AvatarLink'
import Select from './Select'
import TabBar from './TabBar'
import Tips from './Tips'

const RANGES = [3, 6, 12] as const
const card = 'rounded-2xl border border-border bg-surface p-4 shadow-sm'
const th = 'px-3 py-2 font-medium'
const td = 'px-3 py-2 tabular-nums'

export default function StatsPage({ householdId }: { householdId: string }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const money = (n: number) => fmtMoney(n, lng)
  const [allMonths, setAllMonths] = useState<string[] | null>(null)
  const [range, setRange] = useState<(typeof RANGES)[number]>(6)
  const [envs, setEnvs] = useState<StatEnvelope[]>([])
  const [balances, setBalances] = useState<Record<string, Balance>>({})
  const [focus, setFocus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const months = useMemo(() => (allMonths ?? []).slice(-range), [allMonths, range])
  const monthsKey = months.join(',')

  useEffect(() => {
    void listMonths(householdId).then((r) => {
      if (r.error) setError(r.error)
      setAllMonths(r.months)
    })
  }, [householdId])

  useEffect(() => {
    if (!monthsKey) return
    // On garde l'affichage précédent pendant le rechargement (pas de saut de mise en page).
    void loadStats(householdId, monthsKey.split(',')).then((r) => {
      if (r.error) return setError(r.error)
      setError(null)
      setEnvs(r.envelopes)
      setBalances(r.balances)
    })
  }, [householdId, monthsKey])

  const totals = useMemo(() => monthTotals(months, envs), [months, envs])
  const matrix = useMemo(() => envelopeMatrix(months, envs), [months, envs])
  const focusMonth = focus && months.includes(focus) ? focus : months[months.length - 1]
  const weekly = useMemo(() => (focusMonth ? weeklyMatrix(focusMonth, envs) : null), [focusMonth, envs])

  // ---- Conseils d'après l'historique ----
  const insights = useMemo(() => {
    const tips: Tip[] = []
    const withBudget = totals.filter((m) => m.budget > 0)
    if (withBudget.length >= 2) {
      const ratio = (m: (typeof totals)[number]) => m.spent / m.budget
      const best = withBudget.reduce((a, b) => (ratio(b) < ratio(a) ? b : a))
      const worst = withBudget.reduce((a, b) => (ratio(b) > ratio(a) ? b : a))
      if (best.month !== worst.month) {
        tips.push({ key: 'tipStatsBest', params: { month: fmtMonth(best.month, lng), percent: Math.round(ratio(best) * 100) } })
        if (ratio(worst) > 1) {
          tips.push({ key: 'tipStatsWorst', params: { month: fmtMonth(worst.month, lng), percent: Math.round(ratio(worst) * 100) } })
        }
      }
    }
    const recent = months.slice(-3)
    for (const row of matrix) {
      const cells = recent.map((m) => row.cells[m]).filter((c): c is NonNullable<typeof c> => !!c)
      const overs = cells.filter((c) => c.spent > c.budget)
      if (cells.length >= 2 && overs.length >= 2) {
        const average = cells.reduce((s, c) => s + c.spent, 0) / cells.length
        tips.push({
          key: 'tipStatsRaise',
          params: { name: row.name, count: overs.length, total: cells.length, amount: money(Math.ceil(average / 5) * 5) },
        })
      }
    }
    return tips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals, matrix, months, lng])

  // ---- Exports ----
  const statusLabel = { active: t('statusActive'), refunded: t('statusFreed'), kept: t('statusKept') }
  const csvHeaders = [t('csvMonth'), t('csvEnvelope'), t('date'), t('colLabel'), t('amount'), t('colStatus')]
  const csvName = `budget-bloom_${months[0] ?? ''}_${months[months.length - 1] ?? ''}.csv`

  function summaryText() {
    if (!focusMonth) return ''
    const lines = envs
      .filter((e) => e.month === focusMonth)
      .map((e) => `- ${e.name}: ${money(spentOf(e))} / ${money(e.budget)}`)
    const total = totals.find((m) => m.month === focusMonth)
    return [
      `Budget Bloom — ${fmtMonth(focusMonth, lng)}`,
      total ? `${t('budgeted')}: ${money(total.budget)} · ${t('spent')}: ${money(total.spent)}` : '',
      total && total.over > 0 ? t('totalOver', { amount: money(total.over) }) : '',
      '',
      ...lines,
      '',
      t('shareAttachHint'),
    ]
      .filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '')
      .join('\n')
  }

  const exportCsv = () => downloadFile(csvName, 'text/csv', buildCsv(envs, statusLabel, csvHeaders))

  async function exportBackup() {
    const r = await buildBackup(householdId)
    if (r.error || !r.json) return setNotice(`${t('errGeneric')} (${r.error})`)
    downloadFile(`budget-bloom-backup_${todayIso()}.json`, 'application/json', r.json)
    setNotice(t('backupDone'))
  }

  async function share() {
    const content = buildCsv(envs, statusLabel, csvHeaders)
    const subject = `Budget Bloom — ${focusMonth ? fmtMonth(focusMonth, lng) : ''}`
    const shared = await shareFile(new File([content], csvName, { type: 'text/csv' }), subject, summaryText())
    if (shared) return
    // Ordinateur: pas de feuille de partage avec fichier. On télécharge le CSV et on prépare le brouillon.
    downloadFile(csvName, 'text/csv', content)
    openMailDraft(subject, summaryText())
    setNotice(t('shareFallback'))
  }

  const empty = allMonths !== null && allMonths.length === 0
  const rangeLabel = months.length ? `${fmtMonth(months[0], lng)} → ${fmtMonth(months[months.length - 1], lng)}` : ''

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6 md:max-w-3xl md:px-6 xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <TabBar />
        <AvatarLink />
      </header>

      <div className="hidden print:block">
        <h1 className="text-2xl font-semibold">Budget Bloom — {t('tabStats')}</h1>
        <p className="text-sm text-muted">{rangeLabel}</p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-over/10 px-4 py-3 text-sm text-over">
          <p>{t('errLoad')}</p>
          <p className="mt-1 text-xs opacity-80">{error}</p>
        </div>
      )}
      {empty && <p className="text-muted">{t('statsEmpty')}</p>}

      {!empty && (
        <>
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label={t('period')} className="flex rounded-full bg-accent-soft p-0.5 text-xs">
              {RANGES.map((r) => (
                <button
                  key={r}
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={`rounded-full px-3 py-1.5 ${range === r ? 'bg-surface font-medium text-accent-strong shadow-sm' : 'text-muted'}`}
                >
                  {t('lastMonths', { count: r })}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button onClick={() => window.print()} className="rounded-xl bg-accent-soft px-3 py-1.5 text-accent-strong">
                {t('print')}
              </button>
              <button onClick={exportCsv} className="rounded-xl bg-accent-soft px-3 py-1.5 text-accent-strong">
                {t('exportCsv')}
              </button>
              <button onClick={() => void share()} className="rounded-xl bg-accent-soft px-3 py-1.5 text-accent-strong">
                {t('shareByEmail')}
              </button>
              <button onClick={() => void exportBackup()} className="rounded-xl border border-border px-3 py-1.5 text-muted">
                {t('fullBackup')}
              </button>
            </div>
          </div>
          {notice && (
            <p role="status" className="no-print flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm">
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} aria-label={t('close')} className="text-muted">
                ✕
              </button>
            </p>
          )}

          {/* Comparaison mois par mois */}
          <section className={`${card} flex flex-col gap-4`}>
            <h2 className="font-medium">{t('compareMonths')}</h2>
            <GroupedBars
              ariaLabel={t('compareMonths')}
              categories={months.map((m) => fmtMonth(m, lng, 'short'))}
              tooltipTitles={months.map((m) => fmtMonth(m, lng))}
              format={money}
              series={[
                { key: 'budget', label: t('budgeted'), color: 'var(--chart-2)', values: totals.map((m) => m.budget) },
                { key: 'spent', label: t('spent'), color: 'var(--chart-1)', values: totals.map((m) => m.spent) },
              ]}
            />
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-136 border-collapse text-sm">
                <thead>
                  <tr className="bg-accent-soft text-xs uppercase tracking-wide text-accent-strong">
                    <th className={`${th} text-left`}>{t('csvMonth')}</th>
                    <th className={`${th} text-right`}>{t('budgeted')}</th>
                    <th className={`${th} text-right`}>{t('spent')}</th>
                    <th className={`${th} text-right`}>{t('gap')}</th>
                    <th className={`${th} text-right`}>{t('startBalanceShort')}</th>
                    <th className={`${th} text-right`}>{t('endBalanceShort')}</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((m) => {
                    const bal = balances[m.month]
                    const gap = m.budget - m.spent
                    return (
                      <tr key={m.month} className="border-t border-border">
                        <th className={`${td} text-left font-medium capitalize`}>{fmtMonth(m.month, lng)}</th>
                        <td className={`${td} text-right`}>{money(m.budget)}</td>
                        <td className={`${td} text-right`}>{money(m.spent)}</td>
                        <td className={`${td} text-right font-medium ${gap < 0 ? 'text-over' : ''}`}>
                          {gap < 0 ? '▲ ' : ''}
                          {money(gap)}
                        </td>
                        <td className={`${td} text-right text-muted`}>{bal?.start == null ? '—' : money(bal.start)}</td>
                        <td className={`${td} text-right text-muted`}>{bal?.end == null ? '—' : money(bal.end)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <Tips tips={insights} title={t('statsInsights')} />

          {/* Par enveloppe */}
          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="font-medium">{t('byEnvelope')}</h2>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-136 border-collapse text-sm">
                <thead>
                  <tr className="bg-accent-soft text-xs uppercase tracking-wide text-accent-strong">
                    <th className={`${th} text-left`}>{t('csvEnvelope')}</th>
                    {months.map((m) => (
                      <th key={m} className={`${th} text-right capitalize`}>
                        {fmtMonth(m, lng, 'short')}
                      </th>
                    ))}
                    <th className={`${th} text-right`}>{t('average')}</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.name} className="border-t border-border">
                      <th className={`${td} text-left font-medium`}>{row.name}</th>
                      {months.map((m) => {
                        const c = row.cells[m]
                        if (!c) return <td key={m} className={`${td} text-right text-muted`}>—</td>
                        const over = c.spent > c.budget
                        return (
                          <td
                            key={m}
                            title={`${t('budget')} ${money(c.budget)}`}
                            className={`${td} text-right ${over ? 'font-semibold text-over' : ''}`}
                          >
                            {over ? '▲ ' : ''}
                            {money(c.spent)}
                          </td>
                        )
                      })}
                      <td className={`${td} text-right text-muted`}>{money(row.averageSpent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">{t('overLegend')}</p>
          </section>

          {/* Récapitulatif hebdomadaire */}
          {weekly && focusMonth && (
            <section className={`${card} flex flex-col gap-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium">{t('weeklyRecap')}</h2>
                <div className="no-print w-48">
                  <Select
                    variant="field"
                    label={t('csvMonth')}
                    value={focusMonth}
                    options={[...months].reverse().map((m) => ({ value: m, label: fmtMonth(m, lng) }))}
                    onChange={setFocus}
                  />
                </div>
                <p className="hidden text-sm text-muted print:block">{fmtMonth(focusMonth, lng)}</p>
              </div>
              <GroupedBars
                ariaLabel={t('weeklyRecap')}
                height={180}
                categories={weekly.weeks.map((_, i) => t('weekShort', { n: i + 1 }))}
                tooltipTitles={weekly.weeks.map((w) => `${fmtDate(w.start, lng)} – ${fmtDate(w.end, lng)}`)}
                format={money}
                series={[{ key: 'spent', label: t('spent'), color: 'var(--chart-1)', values: weekly.totals }]}
              />
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-136 border-collapse text-sm">
                  <thead>
                    <tr className="bg-accent-soft text-xs uppercase tracking-wide text-accent-strong">
                      <th className={`${th} text-left`}>{t('csvEnvelope')}</th>
                      {weekly.weeks.map((w, i) => (
                        <th key={w.start} className={`${th} text-right`} title={`${fmtDate(w.start, lng)} – ${fmtDate(w.end, lng)}`}>
                          {t('weekShort', { n: i + 1 })}
                        </th>
                      ))}
                      {weekly.otherTotal > 0 && <th className={`${th} text-right`}>{t('otherDates')}</th>}
                      <th className={`${th} text-right`}>{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekly.rows.map((r) => (
                      <tr key={r.name} className="border-t border-border">
                        <th className={`${td} text-left font-medium`}>{r.name}</th>
                        {r.perWeek.map((v, i) => (
                          <td key={i} className={`${td} text-right ${v === 0 ? 'text-muted' : ''}`}>
                            {v === 0 ? '—' : money(v)}
                          </td>
                        ))}
                        {weekly.otherTotal > 0 && <td className={`${td} text-right`}>{r.other ? money(r.other) : '—'}</td>}
                        <td className={`${td} text-right font-medium`}>
                          {money(r.perWeek.reduce((s, v) => s + v, 0) + r.other)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-accent-soft/40 font-semibold">
                      <th className={`${td} text-left`}>{t('total')}</th>
                      {weekly.totals.map((v, i) => (
                        <td key={i} className={`${td} text-right`}>
                          {money(v)}
                        </td>
                      ))}
                      {weekly.otherTotal > 0 && <td className={`${td} text-right`}>{money(weekly.otherTotal)}</td>}
                      <td className={`${td} text-right`}>{money(weekly.totals.reduce((s, v) => s + v, 0) + weekly.otherTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
