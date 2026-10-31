import { ChevronLeft, ChevronRight, CloudOff, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutboxCount } from '../lib/expenses'
import { fmtMoney, fmtMonth } from '../lib/format'
import { colorForIndex } from '../lib/icons'
import { useDataVersion } from '../lib/realtime'
import { useHash } from '../lib/route'
import { supabase } from '../lib/supabase'
import { reallocTips } from '../lib/tips'
import { countsAsSpent, currentMonth, shiftMonth, type Envelope, type EnvelopeGroup } from '../lib/types'
import AvatarLink from './AvatarLink'
import EnvelopeSheet from './budget/EnvelopeSheet'
import GroupSection from './budget/GroupSection'
import GroupSheet from './budget/GroupSheet'
import QuickAddSheet from './budget/QuickAddSheet'
import EnvelopeRow from './budget/EnvelopeRow'
import EnvelopeDetail from './EnvelopeDetail'
import MonthSummary from './MonthSummary'
import ScriptTitle from './ScriptTitle'
import TabBar, { BottomNav } from './TabBar'
import Tips from './Tips'
import Fab from './ui/Fab'
import { PRIMARY } from './ui/Field'
import PageHeader, { IconButton } from './ui/PageHeader'
import Sheet from './ui/Sheet'

const PREFIX = '#/envelope/'
const UNGROUPED = '__ungrouped__'

type SheetState =
  | { kind: 'quick' }
  | { kind: 'envelope'; envelope?: Envelope; groupId?: string | null }
  | { kind: 'group'; group?: EnvelopeGroup }
  | { kind: 'deleteGroup'; group: EnvelopeGroup }
  | null

// Navigation par hash: le bouton « retour » du téléphone ferme le détail.
function useSelectedId() {
  const hash = useHash()
  return hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null
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
  const selectedId = useSelectedId()
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [groups, setGroups] = useState<EnvelopeGroup[]>([])
  const [groupsMissing, setGroupsMissing] = useState(false)
  const [spentBy, setSpentBy] = useState<Record<string, number>>({})
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
    const [first, env, grp] = await Promise.all([
      supabase.from('envelopes').select('month').eq('household_id', householdId).order('month').limit(1).maybeSingle(),
      supabase.from('envelopes').select('*').eq('household_id', householdId).eq('month', month).order('sort').order('created_at'),
      supabase.from('envelope_groups').select('*').eq('household_id', householdId).order('sort').order('created_at'),
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
    if (list.length) {
      const exp = await supabase
        .from('expenses')
        .select('envelope_id, amount, status')
        .in('envelope_id', list.map((e) => e.id))
      if (exp.error) {
        setLoadError(exp.error.message)
        setLoaded(true)
        return
      }
      for (const e of exp.data ?? []) {
        if (countsAsSpent(e.status)) sums[e.envelope_id] = (sums[e.envelope_id] ?? 0) + Number(e.amount)
      }
    }
    if (id !== requestId.current) return // une requête plus récente (autre mois) a pris le relais
    setLoadError(null)
    setEnvelopes(list)
    setGroups((grp.data ?? []) as EnvelopeGroup[])
    setSpentBy(sums)
    setLoaded(true)
  }, [householdId, month, nowMonth])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, version])

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

  const open = (envelopeId: string) => {
    window.location.hash = `${PREFIX}${envelopeId}`
  }
  const totalBudget = envelopes.reduce((s, e) => s + e.budget, 0)
  const totalSpent = envelopes.reduce((s, e) => s + (spentBy[e.id] ?? 0), 0)
  const overList = envelopes.filter((e) => (spentBy[e.id] ?? 0) > e.budget)
  const groupIds = new Set(groups.map((g) => g.id))
  const ungrouped = envelopes.filter((e) => !e.group_id || !groupIds.has(e.group_id))

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 pb-36 pt-[max(1.25rem,env(safe-area-inset-top))] md:pb-16 lg:max-w-5xl">
      <PageHeader
        left={<img src="/favicon.svg" alt="" className="size-9 rounded-xl" />}
        center={
          <>
            <IconButton label={t('prevMonth')} onClick={() => setMonth(shiftMonth(month, -1))} disabled={!firstMonth || month <= firstMonth}>
              <ChevronLeft size={18} />
            </IconButton>
            <h1 className="truncate px-1">{fmtMonth(month, lng)}</h1>
            <IconButton label={t('nextMonth')} onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= nowMonth}>
              <ChevronRight size={18} />
            </IconButton>
          </>
        }
        right={<AvatarLink />}
      />
      <div className="-mt-2 flex flex-col items-center gap-3">
        <TabBar />
        {month !== nowMonth && (
          <button onClick={() => setMonth(nowMonth)} className="no-print text-xs text-accent-strong underline">
            {t('currentMonth')}
          </button>
        )}
      </div>

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

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-14">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <ScriptTitle>{t('summaryTitle')}</ScriptTitle>
          {loaded && !loadError && (
            <MonthSummary
              key={month}
              householdId={householdId}
              month={month}
              totalBudget={totalBudget}
              totalSpent={totalSpent}
              totalOver={overList.reduce((s, e) => s + (spentBy[e.id] ?? 0) - e.budget, 0)}
              overCount={overList.length}
            />
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
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <ScriptTitle>{t('envelopes')}</ScriptTitle>
            {!groupsMissing && (
              <button onClick={() => setSheet({ kind: 'group' })} className="no-print mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
                <Plus size={14} /> {t('group')}
              </button>
            )}
          </div>
          {groupsMissing && <p className="text-xs text-muted">{t('errMigrationGroups')}</p>}
          {loaded && !loadError && envelopes.length === 0 && (
            <p className="text-sm text-muted">{month === nowMonth ? t('noEnvelopes') : t('noEnvelopesPast')}</p>
          )}

          {groups.map((g) => {
            const list = envelopes.filter((e) => e.group_id === g.id)
            return list.length === 0 ? (
              <EmptyGroup key={g.id} group={g} onAdd={() => setSheet({ kind: 'envelope', groupId: g.id })} onDelete={() => setSheet({ kind: 'deleteGroup', group: g })} />
            ) : (
              <GroupSection
                key={g.id}
                id={g.id}
                title={g.name}
                envelopes={list}
                spentBy={spentBy}
                onOpen={open}
                onRename={() => setSheet({ kind: 'group', group: g })}
                onDelete={() => setSheet({ kind: 'deleteGroup', group: g })}
              />
            )
          })}
          {ungrouped.length > 0 &&
            (groups.length > 0 ? (
              <GroupSection id={UNGROUPED} title={t('noGroup')} envelopes={ungrouped} spentBy={spentBy} onOpen={open} />
            ) : (
              <ul className="divide-y divide-dashed divide-muted/30">
                {ungrouped.map((e) => (
                  <EnvelopeRow key={e.id} envelope={e} spent={spentBy[e.id] ?? 0} onOpen={() => open(e.id)} />
                ))}
              </ul>
            ))}

          <button
            onClick={() => setSheet({ kind: 'envelope' })}
            className="no-print flex items-center justify-center gap-2 rounded-full border border-dashed border-accent py-3 text-sm font-medium text-accent-strong hover:bg-accent-soft/50"
          >
            <Plus size={16} /> {t('newEnvelope')}
          </button>
        </div>
      </div>

      {envelopes.length > 0 && <Fab label={t('newExpense')} onClick={() => setSheet({ kind: 'quick' })} />}
      <BottomNav />

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
    </main>
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
