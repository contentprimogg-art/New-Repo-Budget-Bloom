import { ChevronLeft, CloudOff, Pencil, Repeat, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mergePending, mutate } from '../lib/expenses'
import { fmtDate, fmtMoney, fmtMonth, parseAmount } from '../lib/format'
import { useOptionalHousehold } from '../lib/household'
import { IconBadge, colorForIndex } from '../lib/icons'
import { useDataVersion } from '../lib/realtime'
import { FREQUENCIES, lineageOf, makeRecurring, type Frequency } from '../lib/recurring'
import { settleExpense, syncLinkedAmount } from '../lib/savings'
import { supabase } from '../lib/supabase'
import { envelopeTips, type Sibling } from '../lib/tips'
import {
  countsAsSpent,
  currentMonth,
  envelopeStats,
  type Envelope,
  type EnvelopeGroup,
  type Expense,
  type ExpenseStatus,
  type RecurringExpense,
} from '../lib/types'
import EnvelopeSheet from './budget/EnvelopeSheet'
import QuickAddSheet from './budget/QuickAddSheet'
import EnvelopeTable from './EnvelopeTable'
import KeepDialog from './KeepDialog'
import ScriptTitle from './ScriptTitle'
import { AdviceList } from './Companion'
import Tips from './Tips'
import { MemberAvatar } from './ui/AvatarStack'
import Fab from './ui/Fab'
import Donut from './ui/Donut'
import Card from './ui/Card'
import { IconButton } from './ui/PageHeader'
import PageShell from './ui/PageShell'
import SummaryColumns from './ui/SummaryColumns'

type DetailView = 'list' | 'grid' | 'table'
const VIEW_KEY = 'detailView'

function readView(): DetailView {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'grid' || v === 'table') return v
  } catch {
    /* stockage indisponible */
  }
  return 'list'
}

function ViewSwitch({ view, onChange }: { view: DetailView; onChange: (v: DetailView) => void }) {
  const { t } = useTranslation()
  const options: [DetailView, string][] = [
    ['list', t('viewList')],
    ['grid', t('viewGrid')],
    ['table', t('viewTable')],
  ]
  return (
    <div role="group" aria-label={t('view')} className="no-print flex rounded-full border border-accent/60 p-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
      {options.map(([v, label]) => (
        <button
          key={v}
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 ${view === v ? 'bg-accent-soft text-accent-strong' : 'text-muted'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function EnvelopeDetail({
  envelope,
  envelopes,
  groups,
  siblings = [],
  advice,
  onChanged,
  onClose,
}: {
  envelope: Envelope
  envelopes: Envelope[]
  groups: EnvelopeGroup[]
  siblings?: Sibling[]
  /** Conseils du compagnon pour cette enveloppe (mois en cours). */
  advice?: React.ComponentProps<typeof AdviceList>
  onChanged: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const money = (n: number) => fmtMoney(n, lng)
  const version = useDataVersion()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loaded, setLoaded] = useState(false)
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'counted' | 'settled'>('all')
  const [view, setView] = useState<DetailView>(readView)
  const [sheet, setSheet] = useState<'quick' | 'edit' | null>(null)
  const changeView = (v: DetailView) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* stockage indisponible: la vue ne sera pas mémorisée */
    }
  }

  const lineage = lineageOf(envelope)
  const load = useCallback(async () => {
    const [exp, rec] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('envelope_id', envelope.id)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('recurring_expenses').select('*').eq('lineage_id', lineage).order('created_at'),
    ])
    const rows = ((exp.data ?? []) as Expense[]).map((e) => ({ ...e, amount: Number(e.amount) }))
    // Les opérations hors-ligne en attente apparaissent tout de suite.
    setExpenses(mergePending('expenses', rows, (e) => e.envelope_id === envelope.id).sort((a, b) => b.spent_on.localeCompare(a.spent_on)))
    setRecurring(((rec.data ?? []) as RecurringExpense[]).map((r) => ({ ...r, amount: Number(r.amount) })))
    setLoaded(true)
  }, [envelope.id, lineage])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, version])

  const refresh = () => {
    void load()
    onChanged()
  }

  const spent = expenses.reduce((sum, e) => (countsAsSpent(e.status) ? sum + e.amount : sum), 0)
  const stats = envelopeStats(envelope.budget, spent)
  const over = stats.overBy > 0
  const group = groups.find((g) => g.id === envelope.group_id)
  // Filtre local: libellé ou montant, et statut (comptées / remboursées).
  const needle = query.trim().toLowerCase()
  const visible = expenses.filter(
    (e) =>
      (statusFilter === 'all' || (statusFilter === 'counted' ? e.status !== 'refunded' : e.status !== 'active')) &&
      (!needle || (e.note ?? '').toLowerCase().includes(needle) || String(e.amount).replace('.', ',').includes(needle.replace('.', ','))),
  )

  return (
    <PageShell
      wide
      title={envelope.name}
      fab={<Fab label={t('newExpense')} onClick={() => setSheet('quick')} />}
      left={
        <IconButton label={t('back')} onClick={onClose}>
          <ChevronLeft size={22} />
        </IconButton>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
          <span>{fmtMonth(envelope.month, lng)}</span>
          {group && <span>· {group.name}</span>}
          {envelope.recurring && (
            <span className="flex items-center gap-1">
              · <Repeat size={11} /> {t('monthly')}
            </span>
          )}
        </span>
      }
      action={
        <IconButton label={t('renameEdit')} onClick={() => setSheet('edit')}>
          <Pencil size={19} />
        </IconButton>
      }
    >
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card>
            <div className="flex flex-col items-center gap-4">
              <IconBadge icon={envelope.icon} color={envelope.color} size="lg" />
              <Donut
                size={230}
                labels={false}
                ariaLabel={`${envelope.name}: ${money(stats.spent)} / ${money(envelope.budget)}`}
                format={money}
                slices={
                  over
                    ? [{ key: 'over', label: t('overLabel'), value: stats.spent, color: 'var(--over)' }]
                    : [
                        { key: 'spent', label: t('spent'), value: stats.spent, color: 'var(--accent-strong)' },
                        { key: 'left', label: t('remaining'), value: Math.max(stats.remaining, 0), color: 'var(--track)' },
                      ]
                }
                center={
                  <>
                    <span className={`text-3xl font-medium tabular-nums ${over ? 'text-over' : ''}`}>{stats.percent}%</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{t('used')}</span>
                  </>
                }
              />
              <div className="w-full">
                <SummaryColumns
                  items={[
                    { label: t('spent'), value: money(stats.spent), tone: 'var(--accent-strong)' },
                    { label: t('budget'), value: money(envelope.budget), tone: 'var(--chart-2)' },
                    over
                      ? { label: t('overLabel'), value: money(stats.overBy), tone: 'var(--over)', valueClassName: 'text-over' }
                      : { label: t('remaining'), value: money(stats.remaining), tone: 'var(--ok)' },
                  ]}
                />
              </div>
            </div>
          </Card>

          {advice && envelope.month === currentMonth() ? (
            <AdviceList {...advice} />
          ) : (
          <Tips
            tips={envelopeTips({
              envelope,
              expenses,
              siblings,
              nowMonth: currentMonth(),
              today: new Date(),
              unnamed: t('unnamed'),
              money,
            })}
          />
          )}
          {recurring.length > 0 && (
            <Card title={t('recurringExpenses')} description={t('recurringExpensesHint')}>
              <ul className="-my-2 divide-y divide-dashed divide-muted/30">
                {recurring.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <Repeat size={16} className="shrink-0 text-accent-strong" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{r.note || t('unnamed')}</span>
                      <span className="text-xs text-muted">
                        {t(`repeat_${r.every_months}`)} · {t('nextOccurrence', { month: fmtMonth(r.next_month, lng) })}
                      </span>
                    </span>
                    <span className="text-[15px] font-medium tabular-nums">{money(r.amount)}</span>
                    <button
                      type="button"
                      aria-label={t('stopRecurring')}
                      title={t('stopRecurring')}
                      onClick={async () => {
                        await supabase.from('recurring_expenses').delete().eq('id', r.id)
                        void load()
                      }}
                      className="no-print rounded-full p-1 text-muted hover:text-over"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <ScriptTitle>{t('transactions')}</ScriptTitle>
            <div className="mb-2">
              <ViewSwitch view={view} onChange={changeView} />
            </div>
          </div>
          {view !== 'table' && expenses.length > 0 && (
            <div className="no-print flex flex-wrap items-center gap-2">
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 focus-within:border-accent-strong">
                <Search size={15} className="text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('filterPlaceholder')}
                  aria-label={t('filterPlaceholder')}
                  className="w-full border-0 bg-transparent text-sm outline-none focus:shadow-none"
                />
              </label>
              {(['all', 'counted', 'settled'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={statusFilter === f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-2xl border px-3 py-2 text-xs ${statusFilter === f ? 'border-accent bg-accent-soft font-medium text-accent-strong' : 'border-border bg-surface text-muted'}`}
                >
                  {f === 'all' ? t('allStatuses') : f === 'counted' ? t('statusActive') : t('refund')}
                </button>
              ))}
            </div>
          )}
          {loaded && expenses.length === 0 && view !== 'table' && <Card description={t('noTransactions')} />}
          {view !== 'table' && expenses.length > 0 && visible.length === 0 && <Card description={t('noResults')} />}
          {(view === 'table' || expenses.length > 0) &&
            (view === 'table' ? (
              <EnvelopeTable envelope={envelope} expenses={expenses} onChanged={refresh} />
            ) : view === 'grid' ? (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {visible.map((e) => (
                  <TransactionRow key={e.id} householdId={envelope.household_id} envelope={envelope} expense={e} view="grid" onChanged={refresh} />
                ))}
              </ul>
            ) : (
              visible.length > 0 && (
              <Card>
                <ul className="-my-2 divide-y divide-dashed divide-muted/30">
                  {visible.map((e) => (
                    <TransactionRow key={e.id} householdId={envelope.household_id} envelope={envelope} expense={e} view="list" onChanged={refresh} />
                  ))}
                </ul>
              </Card>
              )
            ))}
        </section>
      </div>

      {sheet === 'quick' && (
        <QuickAddSheet envelopes={envelopes} defaultEnvelopeId={envelope.id} onClose={() => setSheet(null)} onAdded={() => refresh()} />
      )}
      {sheet === 'edit' && (
        <EnvelopeSheet
          householdId={envelope.household_id}
          month={envelope.month}
          envelope={envelope}
          groups={groups}
          defaultColor={envelope.color ?? colorForIndex(0)}
          sort={envelope.sort}
          onClose={() => setSheet(null)}
          onSaved={onChanged}
          onDeleted={() => {
            onChanged()
            onClose()
          }}
        />
      )}
    </PageShell>
  )
}

// Une transaction: un appui affiche les actions (rembourser, modifier, supprimer).
export function TransactionRow({
  householdId,
  envelope,
  expense,
  view,
  onChanged,
}: {
  householdId: string
  envelope?: Envelope
  expense: Expense
  view: Exclude<DetailView, 'table'>
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(expense.note ?? '')
  const [amount, setAmount] = useState(String(expense.amount).replace('.', ','))
  const [invalid, setInvalid] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [settling, setSettling] = useState(false)
  const [picking, setPicking] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [repeating, setRepeating] = useState(false)
  const household = useOptionalHousehold()
  const author = expense.created_by ? household?.memberById[expense.created_by] : undefined

  const fail = (message: string) => setFailure(`${t('errSave')} (${message})`)

  async function repeat(every: Frequency) {
    if (!envelope) return
    if (!navigator.onLine) return setFailure(t('repeatNeedsNetwork'))
    const r = await makeRecurring({ envelope, expense, every })
    if (r.error) return setFailure(/recurring_expenses/.test(r.error) ? t('errMigration0008') : `${t('errSave')} (${r.error})`)
    setRepeating(false)
    setFailure(null)
    onChanged()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!(value > 0)) return setInvalid(true)
    // Modification possible hors-ligne (mise en attente puis envoyée au retour du réseau).
    const { error, queued } = await mutate({ kind: 'update', table: 'expenses', id: expense.id, values: { note: note.trim() || null, amount: value } })
    if (error) return fail(error)
    if (!queued) await syncLinkedAmount(expense.id, value)
    setEditing(false)
    setInvalid(false)
    setFailure(null)
    onChanged()
  }

  async function remove() {
    const { error } = await mutate({ kind: 'delete', table: 'expenses', id: expense.id })
    if (error) return fail(error)
    onChanged()
  }

  async function setStatus(status: ExpenseStatus, savingsId?: string | null) {
    // Le remboursement touche aussi l'épargne: il demande le réseau.
    if (!navigator.onLine) return setFailure(t('needsNetwork'))
    const error = await settleExpense({ householdId, expense, status, savingsId, fallbackNote: t('refundedKeptNote') })
    if (error) return fail(error)
    setSettling(false)
    setPicking(false)
    setFailure(null)
    onChanged()
  }

  const settled = expense.status !== 'active'
  const settledNote = expense.status === 'refunded' ? t('refundedFreed') : expense.status === 'kept' ? t('refundedKept') : null
  const day = new Date(`${expense.spent_on}T12:00:00`)
  const money = fmtMoney(expense.amount, lng)
  // Dépense saisie dans une autre devise: montant d'origine en petit sous le montant converti.
  const original = expense.original_currency && expense.original_amount != null ? fmtMoney(Number(expense.original_amount), lng, expense.original_currency) : null
  const struck = settled ? 'text-muted line-through' : ''
  const pill = 'rounded-full border border-accent/60 px-3 py-1 text-accent-strong'

  const details = (
    <div className="no-print flex flex-col gap-2 pb-3 text-xs">
      {editing ? (
        <form onSubmit={save} noValidate className="flex flex-col gap-2">
          <input aria-label={t('transactionName')} value={note} onChange={(e) => setNote(e.target.value)} className="field-line text-sm" />
          <input inputMode="decimal" aria-label={t('amount')} aria-invalid={invalid} value={amount} onChange={(e) => setAmount(e.target.value)} className="field-line text-sm tabular-nums" />
          <div className="flex gap-2">
            <button className="rounded-full bg-accent-strong px-4 py-1.5 font-medium text-on-accent">{t('save')}</button>
            <button type="button" onClick={() => setEditing(false)} className="px-2 text-muted underline">
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {settled ? (
            <button onClick={() => void setStatus('active')} className={pill}>
              {t('undoRefund')}
            </button>
          ) : settling ? (
            <>
              <button onClick={() => void setStatus('refunded')} className={pill}>
                {t('refundFree')}
              </button>
              <button onClick={() => setPicking(true)} className={pill}>
                {t('refundKeep')}
              </button>
              <button onClick={() => setSettling(false)} className="px-1 text-muted underline">
                {t('cancel')}
              </button>
            </>
          ) : (
            <button onClick={() => setSettling(true)} className={pill}>
              {t('refund')}
            </button>
          )}
          <button onClick={() => setEditing(true)} className={pill}>
            {t('edit')}
          </button>
          {envelope && !expense.recurring_id && !expense.pending && (
            <button onClick={() => setRepeating(!repeating)} aria-expanded={repeating} className={pill}>
              {t('repeatAction')}
            </button>
          )}
          {confirming ? (
            <button onClick={() => void remove()} onBlur={() => setConfirming(false)} autoFocus className="rounded-full bg-over/10 px-3 py-1 font-semibold text-over">
              {t('confirmDelete')}
            </button>
          ) : (
            <button onClick={() => setConfirming(true)} className="rounded-full px-3 py-1 text-muted underline">
              {t('delete')}
            </button>
          )}
        </div>
      )}
      {repeating && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">{t('repeat')}:</span>
          {FREQUENCIES.map((f) => (
            <button key={f} onClick={() => void repeat(f)} className="rounded-full bg-accent-soft px-3 py-1 text-accent-strong">
              {t(`repeat_${f}`)}
            </button>
          ))}
        </div>
      )}
      {failure && <p className="text-over">{failure}</p>}
      {picking && (
        <KeepDialog householdId={householdId} onChoose={(savingsId) => void setStatus('kept', savingsId)} onCancel={() => setPicking(false)} />
      )}
    </div>
  )

  const status = settledNote && (
    <p className="text-xs text-accent-strong">
      {settledNote}
      {expense.settled_on && ` · ${fmtDate(expense.settled_on, lng)}`}
    </p>
  )

  if (view === 'grid') {
    return (
      <li className="flex flex-col rounded-3xl border border-border bg-surface px-4 pt-3 shadow-sm">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex flex-col pb-3 text-left">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">{fmtDate(expense.spent_on, lng)}</span>
          <span className={`mt-1 line-clamp-2 min-h-10 text-sm ${struck} ${expense.note ? '' : 'text-muted'}`}>{expense.note || t('unnamed')}</span>
          <span className={`mt-1 text-lg font-medium tabular-nums ${struck}`}>{money}</span>
          {original && <span className="text-[11px] text-muted tabular-nums">{original}</span>}
          {status}
        </button>
        {open && details}
      </li>
    )
  }

  return (
    <li>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 py-3 text-left">
        <span className="flex w-11 shrink-0 flex-col items-center rounded-2xl bg-accent-soft/70 py-1.5 leading-none">
          <span className="text-base font-semibold tabular-nums">{day.getDate()}</span>
          <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted">
            {new Intl.DateTimeFormat(lng, { month: 'short' }).format(day).replace('.', '')}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`flex items-center gap-1.5 truncate text-[15px] ${struck} ${expense.note ? '' : 'text-muted'}`}>
            <span className="truncate">{expense.note || t('unnamed')}</span>
            {expense.recurring_id && <Repeat aria-label={t('recurringExpense')} size={12} className="shrink-0 text-muted" />}
            {expense.pending && <CloudOff aria-label={t('pendingOne')} size={12} className="shrink-0 text-muted" />}
          </span>
          {status}
        </span>
        {household?.shared && author && <MemberAvatar member={author} size={20} />}
        <span className="flex shrink-0 flex-col items-end">
          <span className={`text-[15px] font-medium tabular-nums ${struck}`}>{money}</span>
          {original && <span className="text-[11px] text-muted tabular-nums">{original}</span>}
        </span>
      </button>
      {open && details}
    </li>
  )
}
