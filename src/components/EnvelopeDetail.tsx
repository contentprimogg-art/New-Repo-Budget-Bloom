import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { fmtDate, fmtMoney, parseAmount, todayIso } from '../lib/format'
import { supabase } from '../lib/supabase'
import EnvelopeTable from './EnvelopeTable'
import { countsAsSpent, envelopeStats, type Envelope, type Expense, type ExpenseStatus } from '../lib/types'

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
    <div role="group" aria-label={t('view')} className="no-print flex rounded-full bg-accent-soft p-0.5 text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 ${view === v ? 'bg-surface font-medium text-accent-strong shadow-sm' : 'text-muted'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function EnvelopeDetail({
  envelope,
  onChanged,
  onClose,
}: {
  envelope: Envelope
  onChanged: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<DetailView>(readView)
  const changeView = (v: DetailView) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* stockage indisponible: la vue ne sera pas mémorisée */
    }
  }

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('expenses')
      .select('id, envelope_id, amount, note, spent_on, status, settled_on')
      .eq('envelope_id', envelope.id)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
    setExpenses(((data ?? []) as Expense[]).map((e) => ({ ...e, amount: Number(e.amount) })))
    setLoaded(true)
  }, [envelope.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const refresh = () => {
    void load()
    onChanged()
  }

  const spent = expenses.reduce((sum, e) => (countsAsSpent(e.status) ? sum + e.amount : sum), 0)
  const stats = envelopeStats(envelope.budget, spent)
  const over = stats.overBy > 0

  // Anneau simple: dépensé / restant (ou tout dépensé en rouge si dépassement).
  const slices = over
    ? [{ key: 'over', value: 1 }]
    : [
        { key: 'spent', value: stats.spent },
        { key: 'left', value: Math.max(stats.remaining, 0) },
      ]
  const fills: Record<string, string> = {
    over: 'var(--over)',
    spent: 'var(--accent-strong)',
    left: 'var(--accent-soft)',
  }

  return (
    <main className="fade-up mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl md:px-6 lg:max-w-6xl">
      <header className="no-print flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-muted underline">
          ← {t('back')}
        </button>
        <DeleteEnvelope
          envelope={envelope}
          onDeleted={() => {
            onChanged()
            onClose()
          }}
        />
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[24rem_1fr] xl:grid-cols-[28rem_1fr] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
      <EnvelopeTitle envelope={envelope} onSaved={onChanged} />

      <section className="flex items-center gap-5 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="relative size-32 shrink-0 lg:size-40 xl:size-52">
          <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius="70%"
              outerRadius="98%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} style={{ fill: fills[s.key] }} />
              ))}
            </Pie>
          </PieChart>
          </ResponsiveContainer>
          <span
            className={`absolute inset-0 flex items-center justify-center text-xl font-semibold lg:text-2xl xl:text-3xl ${over ? 'text-over' : 'text-accent-strong'}`}
          >
            {stats.percent}%
          </span>
        </div>
        <dl className="flex flex-col gap-1 text-sm">
          <div>
            <dt className="text-muted">{t('spent')}</dt>
            <dd className="font-semibold">{money(stats.spent)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('budget')}</dt>
            <dd className="font-semibold">{money(envelope.budget)}</dd>
          </div>
          <div>
            <dt className="text-muted">{over ? t('overLabel') : t('remaining')}</dt>
            <dd className={`font-semibold ${over ? 'text-over' : ''}`}>{money(over ? stats.overBy : stats.remaining)}</dd>
          </div>
        </dl>
      </section>

      {view !== 'table' && <NewTransaction envelope={envelope} onAdded={refresh} />}
        </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">{t('transactions')}</h2>
          <ViewSwitch view={view} onChange={changeView} />
        </div>
        {loaded && expenses.length === 0 && view !== 'table' && <p className="text-sm text-muted">{t('noTransactions')}</p>}
        {(view === 'table' || expenses.length > 0) &&
          (view === 'table' ? (
            <EnvelopeTable envelope={envelope} expenses={expenses} onChanged={refresh} />
          ) : (
            <ul className={view === 'grid' ? 'grid grid-cols-2 gap-2 md:grid-cols-3' : 'flex flex-col gap-2'}>
              {expenses.map((e) => (
                <TransactionRow key={e.id} expense={e} view={view} onChanged={refresh} />
              ))}
            </ul>
          ))}
      </section>
      </div>
    </main>
  )
}

function EnvelopeTitle({ envelope, onSaved }: { envelope: Envelope; onSaved: () => void }) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(envelope.name)
  const [budget, setBudget] = useState(String(envelope.budget))
  const [error, setError] = useState<string | null>(null)

  async function toggleRecurring(value: boolean) {
    const { error } = await supabase.from('envelopes').update({ recurring: value }).eq('id', envelope.id)
    if (error) setError(`${t('errSave')} (${error.message})`)
    else onSaved()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(budget)
    if (!name.trim()) return setError(t('errNameRequired'))
    if (!(value >= 0) || budget.trim() === '') return setError(t('errAmount'))
    const { error } = await supabase
      .from('envelopes')
      .update({ name: name.trim(), budget: value })
      .eq('id', envelope.id)
    if (error) return setError(`${t('errSave')} (${error.message})`)
    setError(null)
    setEditing(false)
    onSaved()
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold">{envelope.name}</h1>
          <button
            onClick={() => {
              setName(envelope.name)
              setBudget(String(envelope.budget))
              setEditing(true)
            }}
            className="no-print text-sm text-accent-strong underline"
            title={`${t('budget')} ${fmtMoney(envelope.budget, i18n.language)}`}
          >
            {t('renameEdit')}
          </button>
        </div>
        <label className="no-print flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={envelope.recurring}
            onChange={(e) => void toggleRecurring(e.target.checked)}
          />
          {t('recurringLabel')}
        </label>
        {error && <p className="text-sm text-over">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-2">
      <input
        aria-label={t('envelopeName')}
        aria-invalid={!!error && !name.trim()}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-xl border border-border bg-surface px-3 py-2"
      />
      <input
        inputMode="decimal"
        aria-label={t('envelopeBudget')}
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        className="rounded-xl border border-border bg-surface px-3 py-2"
      />
      {error && <p className="px-1 text-sm text-over">{error}</p>}
      <div className="flex gap-2">
        <button className="flex-1 rounded-xl bg-accent-strong px-4 py-2 font-medium text-white">{t('save')}</button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError(null)
          }}
          className="rounded-xl bg-accent-soft px-4 py-2 text-accent-strong"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}

function NewTransaction({ envelope, onAdded }: { envelope: Envelope; onAdded: () => void }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!(value > 0)) return setError(t('errAmount'))
    setError(null)
    await supabase.from('expenses').insert({
      household_id: envelope.household_id,
      envelope_id: envelope.id,
      amount: value,
      note: note.trim() || null,
      spent_on: date || todayIso(),
    })
    setNote('')
    setAmount('')
    setDate(todayIso())
    onAdded()
  }

  return (
    <form
      onSubmit={add}
      noValidate
      className="no-print flex flex-col gap-2 rounded-2xl border border-dashed border-accent p-4"
    >
      <input
        placeholder={t('transactionName')}
        aria-label={t('transactionName')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="rounded-xl border border-border bg-surface px-3 py-2"
      />
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          placeholder="0,00"
          aria-label={t('amount')}
          aria-invalid={!!error}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2"
        />
        <input
          type="date"
          aria-label={t('date')}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3 py-2"
        />
      </div>
      {error && <p className="px-1 text-sm text-over">{error}</p>}
      <button className="rounded-xl bg-accent-strong px-4 py-2 font-medium text-white">{t('addExpense')}</button>
    </form>
  )
}

function TransactionRow({
  expense,
  view,
  onChanged,
}: {
  expense: Expense
  view: Exclude<DetailView, 'table'>
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(expense.note ?? '')
  const [amount, setAmount] = useState(String(expense.amount))
  const [invalid, setInvalid] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [settling, setSettling] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const fail = (message: string) => setFailure(`${t('errSave')} (${message})`)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!(value > 0)) return setInvalid(true)
    const { error } = await supabase
      .from('expenses')
      .update({ note: note.trim() || null, amount: value })
      .eq('id', expense.id)
    if (error) return fail(error.message)
    setEditing(false)
    setInvalid(false)
    setFailure(null)
    onChanged()
  }

  async function remove() {
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) return fail(error.message)
    onChanged()
  }

  async function setStatus(status: ExpenseStatus) {
    const { error } = await supabase
      .from('expenses')
      .update({ status, settled_on: status === 'active' ? null : todayIso() })
      .eq('id', expense.id)
    if (error) return fail(error.message)
    setSettling(false)
    setFailure(null)
    onChanged()
  }

  const settled = expense.status !== 'active'
  const settledNote =
    expense.status === 'refunded' ? t('refundedFreed') : expense.status === 'kept' ? t('refundedKept') : null
  const date = fmtDate(expense.spent_on, i18n.language)
  const money = fmtMoney(expense.amount, i18n.language)
  const struck = settled ? 'text-muted line-through' : ''

  const editor = (
    <form onSubmit={save} noValidate className="flex flex-col gap-2">
      <input
        aria-label={t('transactionName')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="rounded-xl border border-border px-3 py-2"
      />
      <input
        inputMode="decimal"
        aria-label={t('amount')}
        aria-invalid={invalid}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded-xl border border-border px-3 py-2"
      />
      <div className="flex gap-2">
        <button className="flex-1 rounded-xl bg-accent-strong px-3 py-2 text-white">{t('save')}</button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-xl bg-accent-soft px-3 py-2 text-accent-strong"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )

  if (editing) {
    return <li className="rounded-xl border border-border bg-surface p-3">{editor}</li>
  }

  const status = settledNote && (
    <p className="text-xs text-accent-strong">
      {settledNote}
      {expense.settled_on && ` · ${fmtDate(expense.settled_on, i18n.language)}`}
    </p>
  )

  const actions = (
    <div className="no-print mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {settled ? (
        <button onClick={() => setStatus('active')} className="text-accent-strong underline">
          {t('undoRefund')}
        </button>
      ) : settling ? (
        <>
          <button onClick={() => setStatus('refunded')} className="rounded-full bg-accent-soft px-3 py-1 text-accent-strong">
            {t('refundFree')}
          </button>
          <button onClick={() => setStatus('kept')} className="rounded-full bg-accent-soft px-3 py-1 text-accent-strong">
            {t('refundKeep')}
          </button>
          <button onClick={() => setSettling(false)} className="text-muted underline">
            {t('cancel')}
          </button>
        </>
      ) : (
        <button onClick={() => setSettling(true)} className="text-accent-strong underline">
          {t('refund')}
        </button>
      )}
      <button onClick={() => setEditing(true)} className="text-accent-strong underline">
        {t('edit')}
      </button>
      {confirming ? (
        <button onClick={remove} onBlur={() => setConfirming(false)} autoFocus className="font-semibold text-over underline">
          {t('confirmDelete')}
        </button>
      ) : (
        <button onClick={() => setConfirming(true)} className="text-muted underline">
          {t('delete')}
        </button>
      )}
      {failure && <span className="w-full text-over">{failure}</span>}
    </div>
  )

  if (view === 'grid') {
    return (
      <li className="flex flex-col rounded-xl border border-border bg-surface p-3">
        <p className="text-xs text-muted">{date}</p>
        <p className={`mt-1 line-clamp-2 min-h-10 ${struck} ${expense.note ? '' : 'text-muted'}`}>
          {expense.note || t('unnamed')}
        </p>
        <p className={`mt-1 text-lg font-semibold ${struck}`}>{money}</p>
        {status}
        {actions}
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className={`truncate ${struck} ${expense.note ? '' : 'text-muted'}`}>{expense.note || t('unnamed')}</p>
          <p className="text-xs text-muted">{date}</p>
        </div>
        <span className={`font-semibold ${struck}`}>{money}</span>
      </div>
      {status}
      {actions}
    </li>
  )
}

function DeleteEnvelope({ envelope, onDeleted }: { envelope: Envelope; onDeleted: () => void }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  async function remove() {
    await supabase.from('envelopes').delete().eq('id', envelope.id)
    onDeleted()
  }

  return confirming ? (
    <button onClick={remove} onBlur={() => setConfirming(false)} autoFocus className="text-sm font-semibold text-over underline">
      {t('deleteEnvelopeHint')} {t('confirmDelete')}
    </button>
  ) : (
    <button onClick={() => setConfirming(true)} className="text-sm text-muted underline">
      {t('deleteEnvelope')}
    </button>
  )
}
