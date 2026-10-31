import { ChartPie, Download, Printer, Share2, Wallet } from 'lucide-react'
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
import { chartColor } from '../lib/color'
import { IconBadge, badgeColor, colorForIndex } from '../lib/icons'
import { useDataVersion } from '../lib/realtime'
import type { Tip } from '../lib/tips'
import GroupedBars from './GroupedBars'
import Select from './Select'
import ScriptTitle from './ScriptTitle'
import Donut from './ui/Donut'
import PageShell from './ui/PageShell'
import Tips from './Tips'

const RANGES = [3, 6, 12] as const
const card = 'rounded-3xl border border-border/80 bg-surface p-5 shadow-[0_1px_2px_rgb(26_29_32/0.04)]'
const chip = (on: boolean) =>
  `flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
    on ? 'border-accent bg-surface text-accent-strong' : 'border-transparent text-muted'
  }`
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
  const [incomes, setIncomes] = useState<Record<string, number>>({})
  const [focus, setFocus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [mode, setMode] = useState<'spent' | 'budget'>('spent')
  const version = useDataVersion()

  const months = useMemo(() => (allMonths ?? []).slice(-range), [allMonths, range])
  const monthsKey = months.join(',')

  useEffect(() => {
    void listMonths(householdId).then((r) => {
      if (r.error) setError(r.error)
      setAllMonths(r.months)
    })
  }, [householdId, version])

  useEffect(() => {
    if (!monthsKey) return
    // On garde l'affichage précédent pendant le rechargement (pas de saut de mise en page).
    void loadStats(householdId, monthsKey.split(',')).then((r) => {
      if (r.error) return setError(r.error)
      setError(null)
      setEnvs(r.envelopes)
      setBalances(r.balances)
      setIncomes(r.incomes)
    })
  }, [householdId, monthsKey, version])

  const totals = useMemo(() => monthTotals(months, envs), [months, envs])
  const matrix = useMemo(() => envelopeMatrix(months, envs), [months, envs])
  const focusMonth = focus && months.includes(focus) ? focus : months[months.length - 1]
  const weekly = useMemo(() => (focusMonth ? weeklyMatrix(focusMonth, envs) : null), [focusMonth, envs])
  const breakdown = useMemo(
    () =>
      envs
        .filter((e) => e.month === focusMonth)
        .map((e, i) => ({
          key: e.id,
          label: e.name,
          value: mode === 'spent' ? spentOf(e) : e.budget,
          color: chartColor(badgeColor(e.color ?? colorForIndex(i))),
          icon: e.icon,
          rawColor: e.color ?? colorForIndex(i),
        }))
        .sort((a, b) => b.value - a.value),
    [envs, focusMonth, mode],
  )
  const breakdownTotal = breakdown.reduce((s, b) => s + b.value, 0)

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
    <PageShell wide title={t('tabStats')} subtitle={rangeLabel}>
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
          <div className="no-print flex flex-col items-center gap-3">
            <div role="group" aria-label={t('period')} className="flex gap-1">
              {RANGES.map((r) => (
                <button key={r} aria-pressed={range === r} onClick={() => setRange(r)} className={chip(range === r)}>
                  {t('lastMonths', { count: r })}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-strong">
              <button onClick={() => window.print()} className="flex items-center gap-1.5">
                <Printer size={14} /> {t('print')}
              </button>
              <button onClick={exportCsv} className="flex items-center gap-1.5">
                <Download size={14} /> {t('exportCsv')}
              </button>
              <button onClick={() => void share()} className="flex items-center gap-1.5">
                <Share2 size={14} /> {t('shareByEmail')}
              </button>
              <button onClick={() => void exportBackup()} className="flex items-center gap-1.5 text-muted">
                <Download size={14} /> {t('fullBackup')}
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

          {/* Répartition du mois choisi, façon moodboard: anneau hachuré, bulles d'icônes */}
          {focusMonth && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <ScriptTitle>{t('breakdown')}</ScriptTitle>
                <div className="no-print mb-1 w-48">
                  <Select
                    variant="field"
                    label={t('csvMonth')}
                    value={focusMonth}
                    options={[...months].reverse().map((m) => ({ value: m, label: fmtMonth(m, lng) }))}
                    onChange={setFocus}
                  />
                </div>
              </div>
              <div role="radiogroup" aria-label={t('breakdown')} className="no-print flex justify-center gap-2">
                <button role="radio" aria-checked={mode === 'spent'} onClick={() => setMode('spent')} className={chip(mode === 'spent')}>
                  <ChartPie size={14} /> {t('spent')}
                </button>
                <button role="radio" aria-checked={mode === 'budget'} onClick={() => setMode('budget')} className={chip(mode === 'budget')}>
                  <Wallet size={14} /> {t('budgeted')}
                </button>
              </div>
              <Donut
                size={300}
                gapColor="var(--paper)"
                ariaLabel={`${t('breakdown')} ${fmtMonth(focusMonth, lng)}`}
                format={money}
                slices={breakdown}
                center={
                  <>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{mode === 'spent' ? t('spent') : t('budgeted')}</span>
                    <span className="text-xl font-medium tabular-nums">{money(breakdownTotal)}</span>
                  </>
                }
              />
              <ul className={`${card} divide-y divide-dashed divide-muted/30 py-2`}>
                {breakdown.map((b) => (
                  <li key={b.key} className="flex items-center gap-3 py-3">
                    <IconBadge icon={b.icon} color={b.rawColor} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[15px]">{b.label}</span>
                    <span className="text-xs tabular-nums text-muted">{breakdownTotal ? Math.round((b.value / breakdownTotal) * 100) : 0}%</span>
                    <span className="w-24 text-right text-[15px] font-medium tabular-nums">{money(b.value)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Comparaison mois par mois */}
          <section className={`${card} flex flex-col gap-4`}>
            <ScriptTitle>{t('compareMonths')}</ScriptTitle>
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
                    <th className={`${th} text-right`}>{t('incomes')}</th>
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
                        <td className={`${td} text-right text-ok-ink`}>{incomes[m.month] ? money(incomes[m.month]) : '—'}</td>
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
            <ScriptTitle>{t('byEnvelope')}</ScriptTitle>
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
                <ScriptTitle>{t('weeklyRecap')}</ScriptTitle>
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
    </PageShell>
  )
}
