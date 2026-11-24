import { ChevronLeft, ChevronRight, CloudOff, Plus, Search, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mergePending, useOutboxCount } from '../lib/expenses'
import { fmtMoney, fmtMonth } from '../lib/format'
import { loadForecast, sameName } from '../lib/forecast'
import { balancesKey, homeKey, peek, remember } from '../lib/pageCache'
import { colorForIndex } from '../lib/icons'
import { useDataVersion } from '../lib/realtime'
import { useHash } from '../lib/route'
import { supabase } from '../lib/supabase'
import { useAdvice } from '../lib/useAdvice'
import { countsAsSpent, currentMonth, isOverBudget, overAmount, roundCents, shiftMonth, type Envelope, type EnvelopeGroup, type Income } from '../lib/types'
import EnvelopeSheet from './budget/EnvelopeSheet'
import GroupSection from './budget/GroupSection'
import GroupSheet from './budget/GroupSheet'
import IncomeList from './budget/IncomeList'
import IncomeSheet from './budget/IncomeSheet'
import QuickAddSheet from './budget/QuickAddSheet'
import SearchSheet from './budget/SearchSheet'
import { HouseholdChip } from './HouseholdSwitch'
import EnvelopeRow from './budget/EnvelopeRow'
import EnvelopeDetail from './EnvelopeDetail'
import MonthSummary from './MonthSummary'
import ScriptTitle from './ScriptTitle'
import Companion from './Companion'
import BloomButton from './ui/BloomButton'
import Fab from './ui/Fab'
import { PRIMARY } from './ui/Field'
import Card from './ui/Card'
import { IconButton } from './ui/PageHeader'
import PageShell from './ui/PageShell'
import PageSkeleton from './ui/PageSkeleton'
import Sheet from './ui/Sheet'

const PREFIX = '#/envelope/'
const UNGROUPED = '__ungrouped__'

type SheetState =
  | { kind: 'quick' }
  | { kind: 'envelope'; envelope?: Envelope; groupId?: string | null }
  | { kind: 'group'; group?: EnvelopeGroup }
  | { kind: 'deleteGroup'; group: EnvelopeGroup }
  | { kind: 'income'; income?: Income }
  | { kind: 'search' }
  | null

// Dernières données connues d'un mois: affichées aussitôt au retour sur l'onglet.
interface HomeView {
  envelopes: Envelope[]
  groups: EnvelopeGroup[]
  groupsMissing: boolean
  spentBy: Record<string, number>
  contributors: Record<string, string[]>
  incomes: Income[]
  savedFromBudget: number
  /** Dépenses récurrentes prévues (mois à venir). */
  plannedTotal?: number
}

// Navigation par hash: le bouton « retour » du téléphone ferme le détail.
// « #/envelope/<id>@<mois> » ouvre une enveloppe d'un autre mois (depuis la recherche).
function useSelected() {
  const hash = useHash()
  if (!hash.startsWith(PREFIX)) return { id: null, month: null }
  const [id, month] = hash.slice(PREFIX.length).split('@')
  return { id, month: month ?? null }
}

export default function Home({ householdId }: { householdId: string }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const version = useDataVersion()
  const pending = useOutboxCount()
  const nowMonth = currentMonth()
  const [month, setMonth] = useState(nowMonth)
  const [rolled, setRolled] = useState(0)
  const { id: selectedId, month: selectedMonth } = useSelected()
  const [known] = useState(() => peek<HomeView>(homeKey(householdId, nowMonth)))
  const [envelopes, setEnvelopes] = useState<Envelope[]>(known?.envelopes ?? [])
  const [groups, setGroups] = useState<EnvelopeGroup[]>(known?.groups ?? [])
  const [groupsMissing, setGroupsMissing] = useState(known?.groupsMissing ?? false)
  const [spentBy, setSpentBy] = useState<Record<string, number>>(known?.spentBy ?? {})
  const [contributors, setContributors] = useState<Record<string, string[]>>(known?.contributors ?? {})
  const [incomes, setIncomes] = useState<Income[]>(known?.incomes ?? [])
  const [savedFromBudget, setSavedFromBudget] = useState(known?.savedFromBudget ?? 0)
  const [plannedTotal, setPlannedTotal] = useState(known?.plannedTotal ?? 0)
  const [preparing, setPreparing] = useState(false)
  const [loaded, setLoaded] = useState(!!known)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const rolledOver = useRef(false)
  const companion = useAdvice(householdId)
  const requestId = useRef(0)

  const showView = useCallback((v: HomeView) => {
    setEnvelopes(v.envelopes)
    setGroups(v.groups)
    setGroupsMissing(v.groupsMissing)
    setSpentBy(v.spentBy)
    setContributors(v.contributors)
    setIncomes(v.incomes)
    setSavedFromBudget(v.savedFromBudget)
    setPlannedTotal(v.plannedTotal ?? 0)
    setLoaded(true)
  }, [])

  const load = useCallback(async (): Promise<HomeView | undefined> => {
    const id = ++requestId.current
    if (!rolledOver.current) {
      rolledOver.current = true
      // Reconduit les enveloppes récurrentes au premier chargement du mois en cours (sans effet ensuite).
      const { data, error } = await supabase.rpc('rollover_month', { h: householdId, m: nowMonth })
      if (error) console.warn('rollover_month:', error.message)
      else if (typeof data === 'number' && data > 0) setRolled(data)
    }
    const [env, grp, inc, bal] = await Promise.all([
      supabase.from('envelopes').select('*').eq('household_id', householdId).eq('month', month).order('sort').order('created_at'),
      supabase.from('envelope_groups').select('*').eq('household_id', householdId).order('sort').order('created_at'),
      supabase.from('incomes').select('*').eq('household_id', householdId).eq('month', month).order('received_on'),
      supabase.from('month_balances').select('*').eq('household_id', householdId).in('month', [month, shiftMonth(month, -1)]),
    ])
    if (env.error) {
      setLoadError(env.error.message)
      setLoaded(true)
      return
    }
    // Les soldes sont prêts avant l'affichage du résumé: pas de « — » qui clignote.
    if (!bal.error) {
      const num = (v: unknown) => (v == null ? null : Number(v))
      const current = bal.data?.find((r) => r.month === month)
      remember(balancesKey(householdId, month), {
        start: num(current?.start_balance),
        end: num(current?.end_balance),
        prevEnd: num(bal.data?.find((r) => r.month !== month)?.end_balance),
      })
    }
    const list = (env.data ?? []).map((e) => ({ ...e, budget: Number(e.budget) })) as Envelope[]
    const sums: Record<string, number> = {}
    const authors: Record<string, Set<string>> = {}
    if (list.length) {
      const ids = new Set(list.map((e) => e.id))
      const exp = await supabase
        .from('expenses')
        .select('id, envelope_id, amount, status, created_by')
        .in('envelope_id', [...ids])
      if (exp.error) {
        setLoadError(exp.error.message)
        setLoaded(true)
        return
      }
      // Les dépenses saisies hors-ligne (pas encore envoyées) comptent déjà.
      const rows = mergePending('expenses', (exp.data ?? []) as { id: string; envelope_id: string; amount: number; status: 'active' | 'refunded' | 'kept'; created_by: string | null }[], (r) => ids.has(r.envelope_id))
      for (const e of rows) {
        if (countsAsSpent(e.status)) sums[e.envelope_id] = (sums[e.envelope_id] ?? 0) + Number(e.amount)
        if (e.created_by) (authors[e.envelope_id] ??= new Set()).add(e.created_by)
      }
    }
    // Revenus: facultatifs tant que la migration 0008 n'est pas passée.
    const incomeRows = mergePending(
      'incomes',
      ((inc.data ?? []) as Income[]).map((i) => ({ ...i, amount: Number(i.amount) })),
      (i) => i.month === month,
    ).sort((a, b) => a.received_on.localeCompare(b.received_on))
    // Mois à venir: éléments récurrents « prévus » (si le mois n'est pas préparé) et dépenses récurrentes prévues.
    let shownEnvelopes = list
    let shownIncomes = incomeRows
    let plannedSum = 0
    if (month > nowMonth) {
      const prepared = !bal.error && bal.data?.find((r) => r.month === month)?.prepared === true
      const f = await loadForecast(householdId, month, list, incomeRows, prepared)
      shownEnvelopes = [...list, ...f.envelopes].sort((a, b) => a.sort - b.sort)
      shownIncomes = [...incomeRows, ...f.incomes].sort((a, b) => a.received_on.localeCompare(b.received_on))
      for (const [key, amount] of Object.entries(f.planned)) {
        sums[key] = (sums[key] ?? 0) + amount
        plannedSum += amount
      }
    }
    // Épargne prise sur l'argent de ce mois (dépôts moins retraits; migration 0011).
    const saved = await supabase
      .from('savings_entries')
      .select('amount')
      .eq('household_id', householdId)
      .eq('from_budget', true)
      .gte('entry_date', `${month}-01`)
      .lt('entry_date', `${shiftMonth(month, 1)}-01`)
    for (const key of Object.keys(sums)) sums[key] = roundCents(sums[key])
    // Les groupes sont facultatifs: sans la migration 0006, on affiche simplement les enveloppes.
    const view: HomeView = {
      envelopes: shownEnvelopes,
      groups: (grp.data ?? []) as EnvelopeGroup[],
      groupsMissing: !!grp.error,
      spentBy: sums,
      contributors: Object.fromEntries(Object.entries(authors).map(([k, v]) => [k, [...v]])),
      incomes: shownIncomes,
      savedFromBudget: saved.error ? 0 : (saved.data ?? []).reduce((s, r) => s + Number(r.amount), 0),
      plannedTotal: roundCents(plannedSum),
    }
    remember(homeKey(householdId, month), view)
    if (id !== requestId.current) return view // une requête plus récente (autre mois) a pris le relais
    setLoadError(null)
    showView(view)
    return view
  }, [householdId, month, nowMonth, showView])

  // Préparer un mois à venir: ses enveloppes et revenus prévus sont créés pour pouvoir les modifier.
  const prepareMonth = async (): Promise<HomeView | null> => {
    if (!navigator.onLine) {
      setNotice(t('needsNetwork'))
      return null
    }
    setPreparing(true)
    const { error } = await supabase.rpc('prepare_month', { h: householdId, m: month })
    if (error) {
      setPreparing(false)
      setNotice(/prepare_month|function/i.test(error.message) ? t('errMigration0012') : `${t('errSave')} (${error.message})`)
      return null
    }
    const view = await load()
    setPreparing(false)
    setNotice(null)
    return view ?? null
  }

  // Changement de mois: données déjà connues tout de suite, sinon silhouette (jamais celles d'un autre mois).
  const shownMonth = useRef(month)
  useEffect(() => {
    if (shownMonth.current === month) return
    shownMonth.current = month
    const cached = peek<HomeView>(homeKey(householdId, month))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) showView(cached)
    else setLoaded(false)
  }, [householdId, month, showView])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, version])

  // Ouverture d'une enveloppe d'un autre mois (lien depuis la recherche): on se place sur ce mois.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedMonth && selectedMonth !== month) setMonth(selectedMonth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  const onAdded = (queued: boolean) => {
    setNotice(queued ? t('savedOffline') : null)
    void load()
  }

  const realEnvelopes = envelopes.filter((e) => !e.forecast)
  const hasForecast = envelopes.some((e) => e.forecast) || incomes.some((i) => i.forecast)
  const selected = selectedId ? realEnvelopes.find((e) => e.id === selectedId) : undefined
  if (selected) {
    return (
      <EnvelopeDetail
        envelope={selected}
        envelopes={realEnvelopes}
        groups={groups}
        knownSpent={spentBy[selected.id] ?? 0}
        siblings={realEnvelopes
          .filter((e) => e.id !== selected.id)
          .map((e) => ({ name: e.name, remaining: e.budget - (spentBy[e.id] ?? 0) }))}
        advice={
          companion.enabled
            ? { advice: companion.advice.filter((a) => a.envelopeId === selected.id), hide: companion.hide, apply: companion.apply }
            : undefined
        }
        onChanged={load}
        onClose={() => {
          window.location.hash = ''
        }}
      />
    )
  }

  const goTo = (envelopeId: string, m?: string) => {
    window.location.hash = m && m !== month ? `${PREFIX}${envelopeId}@${m}` : `${PREFIX}${envelopeId}`
  }
  const open = async (envelopeId: string, m?: string) => {
    const planned = envelopes.find((e) => e.id === envelopeId && e.forecast)
    if (!planned) return goTo(envelopeId, m)
    if (preparing) return
    const view = await prepareMonth()
    const target = view?.envelopes.find((e) => !e.forecast && (e.lineage_id === planned.lineage_id || sameName(e.name, planned.name)))
    if (target) goTo(target.id)
  }
  const editIncome = async (income: Income) => {
    if (!income.forecast) return setSheet({ kind: 'income', income })
    if (preparing) return
    const view = await prepareMonth()
    const target = view?.incomes.find((i) => !i.forecast && sameName(i.label, income.label))
    if (target) setSheet({ kind: 'income', income: target })
  }
  const quickAdd = async () => {
    if (hasForecast && !(await prepareMonth())) return
    setSheet({ kind: 'quick' })
  }
  const totalIncome = roundCents(incomes.reduce((s, i) => s + i.amount, 0))
  const totalBudget = roundCents(envelopes.reduce((s, e) => s + e.budget, 0))
  const totalSpent = roundCents(envelopes.reduce((s, e) => s + (spentBy[e.id] ?? 0), 0))
  const overList = envelopes.filter((e) => isOverBudget(spentBy[e.id] ?? 0, e.budget))
  const groupIds = new Set(groups.map((g) => g.id))
  const ungrouped = envelopes.filter((e) => !e.group_id || !groupIds.has(e.group_id))

  return (
    <PageShell
      wide
      title={t('tabBudget')}
      action={
        <span className="flex items-center">
          <IconButton label={t('search')} onClick={() => setSheet({ kind: 'search' })}>
            <Search size={21} />
          </IconButton>
          <span className="lg:hidden">
            <IconButton label={t('settings')} href="#/profile">
              <Settings size={21} />
            </IconButton>
          </span>
        </span>
      }
      fab={envelopes.length > 0 ? <Fab label={t('newExpense')} onClick={() => void quickAdd()} /> : undefined}
      subtitle={
        <>
        <HouseholdChip />
        <div className="mt-2 inline-flex items-center rounded-full border border-border bg-surface py-0.5 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-text">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label={t('prevMonth')}
            className="grid size-8 place-items-center rounded-full"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="whitespace-nowrap px-1">{fmtMonth(month, lng)}</span>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label={t('nextMonth')}
            className="grid size-8 place-items-center rounded-full"
          >
            <ChevronRight size={16} />
          </button>
          {month !== nowMonth && (
            <button onClick={() => setMonth(nowMonth)} className="no-print pr-3 normal-case tracking-normal text-accent-strong underline">
              {t('currentMonth')}
            </button>
          )}
        </div>
        </>
      }
    >
      {rolled > 0 && month === nowMonth && (
        <p className="no-print flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          <span>{t('rolledOver', { count: rolled })}</span>
          <button onClick={() => setRolled(0)} aria-label={t('close')} className="text-muted">
            ✕
          </button>
        </p>
      )}
      {preparing && (
        <p role="status" className="no-print rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          {t('preparingMonth')}
        </p>
      )}
      {!preparing && hasForecast && <p className="no-print rounded-2xl bg-accent-soft px-4 py-3 text-sm">{t('forecastNotice')}</p>}
      {!preparing && !hasForecast && plannedTotal > 0 && month > nowMonth && (
        <p className="no-print rounded-2xl bg-accent-soft px-4 py-3 text-sm">{t('plannedNotice', { amount: fmtMoney(plannedTotal, lng) })}</p>
      )}
      {(pending > 0 || notice) && (
        <p role="status" className="no-print flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm shadow-sm">
          <CloudOff size={16} className="shrink-0 text-muted" />
          {pending > 0 ? t('pendingExpenses', { count: pending }) : notice}
        </p>
      )}
      {loadError && (
        <div role="alert" className="rounded-2xl bg-over/10 px-4 py-3 text-sm text-over">
          <p>{t('errLoad')}</p>
          <p className="mt-1 text-xs opacity-80">{loadError}</p>
        </div>
      )}

      {!loaded && <PageSkeleton />}
      <div className={`flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12 ${loaded ? '' : 'hidden!'}`}>
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <ScriptTitle>{t('summaryTitle')}</ScriptTitle>
          {loaded && !loadError && (
            <Card>
              <MonthSummary
                key={month}
                householdId={householdId}
                month={month}
                totalBudget={totalBudget}
                totalSpent={totalSpent}
                totalIncome={totalIncome}
                savedFromBudget={savedFromBudget}
                totalOver={roundCents(overList.reduce((s, e) => s + overAmount(spentBy[e.id] ?? 0, e.budget), 0))}
                overCount={overList.length}
              />
            </Card>
          )}
          {loaded && !loadError && companion.enabled && month === nowMonth && envelopes.length > 0 && (
            <>
              <ScriptTitle>{t('companionTitle')}</ScriptTitle>
              <Companion advice={companion.advice} hide={companion.hide} apply={companion.apply} />
            </>
          )}
          {loaded && !loadError && (
            <>
              <div className="flex items-end justify-between gap-3">
                <ScriptTitle>{t('incomes')}</ScriptTitle>
                <button onClick={() => setSheet({ kind: 'income' })} className="no-print mb-2 flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent">
                  <Plus size={14} /> {t('newIncomeShort')}
                </button>
              </div>
              <IncomeList incomes={incomes} onEdit={(income) => void editIncome(income)} />
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <ScriptTitle>{t('envelopes')}</ScriptTitle>
            {!groupsMissing && (
              <button onClick={() => setSheet({ kind: 'group' })} className="no-print mb-2 flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent">
                <Plus size={14} /> {t('newGroup')}
              </button>
            )}
          </div>
          {groupsMissing && <p className="text-xs text-muted">{t('errMigrationGroups')}</p>}
          {loaded && !loadError && envelopes.length === 0 && (
            <Card description={month === nowMonth ? t('noEnvelopes') : t('noEnvelopesPast')} />
          )}

          {groups.map((g) => {
            const list = envelopes.filter((e) => e.group_id === g.id)
            return (
              <Card key={g.id}>
                {list.length === 0 ? (
                  <EmptyGroup group={g} onAdd={() => setSheet({ kind: 'envelope', groupId: g.id })} onDelete={() => setSheet({ kind: 'deleteGroup', group: g })} />
                ) : (
                  <GroupSection
                    id={g.id}
                    title={g.name}
                    envelopes={list}
                    spentBy={spentBy}
                    contributors={contributors}
                    onOpen={open}
                    onRename={() => setSheet({ kind: 'group', group: g })}
                    onDelete={() => setSheet({ kind: 'deleteGroup', group: g })}
                  />
                )}
              </Card>
            )
          })}
          {ungrouped.length > 0 && (
            <Card>
              {groups.length > 0 ? (
                <GroupSection id={UNGROUPED} title={t('noGroup')} envelopes={ungrouped} spentBy={spentBy} contributors={contributors} onOpen={open} />
              ) : (
                <ul className="-my-2 divide-y divide-dashed divide-muted/30">
                  {ungrouped.map((e) => (
                    <EnvelopeRow key={e.id} envelope={e} spent={spentBy[e.id] ?? 0} contributors={contributors[e.id]} onOpen={() => open(e.id)} />
                  ))}
                </ul>
              )}
            </Card>
          )}

          <BloomButton label={t('newEnvelope')} onClick={() => setSheet({ kind: 'envelope' })} />
        </div>
      </div>

      {sheet?.kind === 'quick' && <QuickAddSheet envelopes={realEnvelopes} onClose={() => setSheet(null)} onAdded={onAdded} />}
      {sheet?.kind === 'envelope' && (
        <EnvelopeSheet
          householdId={householdId}
          month={month}
          envelope={sheet.envelope}
          groups={groups}
          defaultGroupId={sheet.groupId}
          defaultColor={colorForIndex(envelopes.length)}
          sort={envelopes.length}
          onClose={() => setSheet(null)}
          onSaved={load}
        />
      )}
      {sheet?.kind === 'income' && (
        <IncomeSheet
          householdId={householdId}
          month={month}
          income={sheet.income}
          onClose={() => setSheet(null)}
          onSaved={(queued) => {
            setNotice(queued ? t('savedOffline') : null)
            void load()
          }}
        />
      )}
      {sheet?.kind === 'search' && (
        <SearchSheet
          householdId={householdId}
          onClose={() => setSheet(null)}
          onOpen={(target) => {
            if (target.kind === 'envelope') {
              setSheet(null)
              goTo(target.id, target.month)
            } else if (target.kind === 'income') {
              // Revenu: on se place sur son mois et on ouvre sa fiche.
              setMonth(target.income.month)
              setSheet({ kind: 'income', income: target.income })
            } else {
              window.location.hash = `#/savings/${target.id}`
            }
          }}
        />
      )}
      {sheet?.kind === 'group' && (
        <GroupSheet householdId={householdId} group={sheet.group} sort={groups.length} onClose={() => setSheet(null)} onSaved={load} />
      )}
      {sheet?.kind === 'deleteGroup' && (
        <Sheet title={t('deleteGroup')} onClose={() => setSheet(null)}>
          <p className="text-sm">{t('deleteGroupHint', { name: sheet.group.name })}</p>
          <button
            className={`${PRIMARY} bg-over! text-white! shadow-over/30!`}
            onClick={async () => {
              await supabase.from('envelope_groups').delete().eq('id', sheet.group.id)
              setSheet(null)
              void load()
            }}
          >
            {t('deleteGroup')}
          </button>
        </Sheet>
      )}
    </PageShell>
  )
}

function EmptyGroup({ group, onAdd, onDelete }: { group: EnvelopeGroup; onAdd: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{group.name}</p>
      <p className="flex flex-wrap gap-x-3 text-xs text-muted">
        {t('emptyGroup')}
        <button onClick={onAdd} className="no-print text-accent-strong underline">
          {t('addEnvelope')}
        </button>
        <button onClick={onDelete} className="no-print underline">
          {t('deleteGroup')}
        </button>
      </p>
    </section>
  )
}
