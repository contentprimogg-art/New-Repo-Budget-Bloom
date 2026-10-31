import { ChevronLeft, ChevronRight, CloudOff, Plus, Search, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mergePending, useOutboxCount } from '../lib/expenses'
import { fmtMoney, fmtMonth } from '../lib/format'
import { colorForIndex } from '../lib/icons'
import { useDataVersion } from '../lib/realtime'
import { useHash } from '../lib/route'
import { supabase } from '../lib/supabase'
import { reallocTips } from '../lib/tips'
import { countsAsSpent, currentMonth, shiftMonth, type Envelope, type EnvelopeGroup, type Income } from '../lib/types'
import EnvelopeSheet from './budget/EnvelopeSheet'
import GroupSection from './budget/GroupSection'
import GroupSheet from './budget/GroupSheet'
import IncomeList from './budget/IncomeList'
import IncomeSheet from './budget/IncomeSheet'
import QuickAddSheet from './budget/QuickAddSheet'
import SearchSheet from './budget/SearchSheet'
import EnvelopeRow from './budget/EnvelopeRow'
import EnvelopeDetail from './EnvelopeDetail'
import MonthSummary from './MonthSummary'
import ScriptTitle from './ScriptTitle'
import Tips from './Tips'
import BloomButton from './ui/BloomButton'
import Fab from './ui/Fab'
import { PRIMARY } from './ui/Field'
import Card from './ui/Card'
import { IconButton } from './ui/PageHeader'
import PageShell from './ui/PageShell'
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
  const money = (n: number) => fmtMoney(n, lng)
  const version = useDataVersion()
  const pending = useOutboxCount()
  const nowMonth = currentMonth()
  const [month, setMonth] = useState(nowMonth)
  const [firstMonth, setFirstMonth] = useState<string | null>(null)
  const [rolled, setRolled] = useState(0)
  const { id: selectedId, month: selectedMonth } = useSelected()
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [groups, setGroups] = useState<EnvelopeGroup[]>([])
  const [groupsMissing, setGroupsMissing] = useState(false)
  const [spentBy, setSpentBy] = useState<Record<string, number>>({})
  const [contributors, setContributors] = useState<Record<string, string[]>>({})
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const rolledOver = useRef(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    if (!rolledOver.current) {
      rolledOver.current = true
      // Reconduit les enveloppes récurrentes au premier chargement du mois en cours (sans effet ensuite).
      const { data, error } = await supabase.rpc('rollover_month', { h: householdId, m: nowMonth })
      if (error) console.warn('rollover_month:', error.message)
      else if (typeof data === 'number' && data > 0) setRolled(data)
    }
    const [first, env, grp, inc] = await Promise.all([
      supabase.from('envelopes').select('month').eq('household_id', householdId).order('month').limit(1).maybeSingle(),
      supabase.from('envelopes').select('*').eq('household_id', householdId).eq('month', month).order('sort').order('created_at'),
      supabase.from('envelope_groups').select('*').eq('household_id', householdId).order('sort').order('created_at'),
      supabase.from('incomes').select('*').eq('household_id', householdId).eq('month', month).order('received_on'),
    ])
    if (first.data) setFirstMonth(first.data.month)
    if (env.error) {
      setLoadError(env.error.message)
      setLoaded(true)
      return
    }
    // Les groupes sont facultatifs: sans la migration 0006, on affiche simplement les enveloppes.
    setGroupsMissing(!!grp.error)
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
    if (id !== requestId.current) return // une requête plus récente (autre mois) a pris le relais
    setLoadError(null)
    setEnvelopes(list)
    setGroups((grp.data ?? []) as EnvelopeGroup[])
    setSpentBy(sums)
    setContributors(Object.fromEntries(Object.entries(authors).map(([k, v]) => [k, [...v]])))
    setIncomes(incomeRows)
    setLoaded(true)
  }, [householdId, month, nowMonth])

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

  const selected = selectedId ? envelopes.find((e) => e.id === selectedId) : undefined
  if (selected) {
    return (
      <EnvelopeDetail
        envelope={selected}
        envelopes={envelopes}
        groups={groups}
        siblings={envelopes
          .filter((e) => e.id !== selected.id)
          .map((e) => ({ name: e.name, remaining: e.budget - (spentBy[e.id] ?? 0) }))}
        onChanged={load}
        onClose={() => {
          window.location.hash = ''
        }}
      />
    )
  }

  const open = (envelopeId: string, m?: string) => {
    window.location.hash = m && m !== month ? `${PREFIX}${envelopeId}@${m}` : `${PREFIX}${envelopeId}`
  }
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalBudget = envelopes.reduce((s, e) => s + e.budget, 0)
  const totalSpent = envelopes.reduce((s, e) => s + (spentBy[e.id] ?? 0), 0)
  const overList = envelopes.filter((e) => (spentBy[e.id] ?? 0) > e.budget)
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
          <IconButton label={t('settings')} href="#/profile">
            <Settings size={21} />
          </IconButton>
        </span>
      }
      fab={envelopes.length > 0 ? <Fab label={t('newExpense')} onClick={() => setSheet({ kind: 'quick' })} /> : undefined}
      subtitle={
        <div className="mt-2 inline-flex items-center rounded-full border border-border bg-surface py-0.5 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-text">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={!firstMonth || month <= firstMonth}
            aria-label={t('prevMonth')}
            className="grid size-8 place-items-center rounded-full disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-1">{fmtMonth(month, lng)}</span>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= nowMonth}
            aria-label={t('nextMonth')}
            className="grid size-8 place-items-center rounded-full disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
          {month !== nowMonth && (
            <button onClick={() => setMonth(nowMonth)} className="no-print pr-3 normal-case tracking-normal text-accent-strong underline">
              {t('currentMonth')}
            </button>
          )}
        </div>
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

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
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
                totalOver={overList.reduce((s, e) => s + (spentBy[e.id] ?? 0) - e.budget, 0)}
                overCount={overList.length}
              />
            </Card>
          )}
          {loaded && !loadError && (
            <Tips
              title={t('tipsOverTitle')}
              tips={reallocTips(
                envelopes.map((e) => ({ name: e.name, budget: e.budget, spent: spentBy[e.id] ?? 0 })),
                money,
              )}
            />
          )}
          {loaded && !loadError && (
            <>
              <div className="flex items-end justify-between gap-3">
                <ScriptTitle>{t('incomes')}</ScriptTitle>
                <button onClick={() => setSheet({ kind: 'income' })} className="no-print mb-2 flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent">
                  <Plus size={14} /> {t('newIncomeShort')}
                </button>
              </div>
              <IncomeList incomes={incomes} onEdit={(income) => setSheet({ kind: 'income', income })} />
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

      {sheet?.kind === 'quick' && <QuickAddSheet envelopes={envelopes} onClose={() => setSheet(null)} onAdded={onAdded} />}
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
          onOpen={(envelopeId, m) => {
            setSheet(null)
            open(envelopeId, m)
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
