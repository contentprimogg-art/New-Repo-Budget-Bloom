import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtDate, fmtMoney, parseAmount, todayIso } from '../lib/format'
import {
  childrenOf,
  milestonesOf,
  totalOf,
  type SavingsData,
  type SavingsEntry,
  type SavingsEnvelope,
} from '../lib/savings'
import { supabase } from '../lib/supabase'
import ConfirmButton from './ConfirmButton'
import MilestoneBar from './MilestoneBar'
import ScriptTitle from './ScriptTitle'
import Select from './Select'

const INPUT = 'w-full rounded-xl border border-border bg-surface px-3 py-2'
const BUTTON = 'rounded-full bg-accent-strong px-4 py-2 font-medium text-white'
const round = (n: number) => Math.round(n * 100) / 100

export default function SavingsDetail({
  data,
  envelope,
  householdId,
  reload,
}: {
  data: SavingsData
  envelope: SavingsEnvelope
  householdId: string
  reload: () => void
}) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const parent = envelope.parent_id ? data.envelopes.find((e) => e.id === envelope.parent_id) : undefined
  const children = childrenOf(data, envelope.id)
  const total = totalOf(data, envelope.id)
  const own = data.own[envelope.id] ?? 0
  const milestones = milestonesOf(data, envelope.id)
  const goal = envelope.target ?? (milestones.length ? Math.max(...milestones) : null)
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('savings_entries')
      .select('id, savings_id, amount, note, entry_date, source_expense_id, transfer_id')
      .eq('savings_id', envelope.id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) return setEntriesError(error.message)
    setEntriesError(null)
    setEntries((rows ?? []).map((r) => ({ ...r, amount: Number(r.amount) })))
  }, [envelope.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEntries()
  }, [loadEntries])

  const refresh = () => {
    void loadEntries()
    reload()
  }

  const backHref = parent ? `#/savings/${parent.id}` : '#/savings'

  return (
    <main className="fade-up mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl md:px-6 lg:max-w-6xl">
      <header className="no-print flex items-center justify-between gap-3">
        <a href={backHref} className="text-sm text-muted underline">
          ← {parent ? parent.name : t('back')}
        </a>
        <ConfirmButton
          label={t('deleteSavings')}
          confirmLabel={children.length ? `${t('deleteSavingsHint')} ${t('confirmDelete')}` : t('confirmDelete')}
          onConfirm={async () => {
            await supabase.from('savings_envelopes').delete().eq('id', envelope.id)
            reload()
            window.location.hash = backHref
          }}
          className="text-sm text-muted underline"
          confirmClassName="text-sm font-semibold text-over underline"
        />
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[24rem_1fr] lg:items-start lg:gap-6 xl:grid-cols-[28rem_1fr]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Title envelope={envelope} onSaved={reload} />

          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div>
              <p className="text-sm text-muted">{children.length ? t('totalWithSub') : t('savedSoFar')}</p>
              <p className="text-3xl font-semibold tabular-nums">{money(total)}</p>
            </div>
            <MilestoneBar balance={total} target={envelope.target} milestones={milestones} format={money} />
            {goal && total < goal && (
              <p className="text-sm text-muted">{t('leftToSave', { amount: money(goal - total) })}</p>
            )}
            {children.length > 0 && (
              <p className={`text-sm ${own < 0 ? 'font-medium text-over' : 'text-muted'}`}>
                {t('unallocated')}: {money(own)}
                {own < 0 && ` · ${t('overAllocated')}`}
              </p>
            )}
          </section>

          <MovementForm envelope={envelope} householdId={householdId} own={own} isPool={children.length > 0} onDone={refresh} />
        </div>

        <div className="flex flex-col gap-4">
          {!parent && (
            <SubEnvelopes
              data={data}
              envelope={envelope}
              householdId={householdId}
              children={children}
              onChanged={refresh}
            />
          )}
          <Milestones envelope={envelope} householdId={householdId} data={data} onChanged={reload} />
          <section className="flex flex-col gap-2">
            <ScriptTitle>{t('movements')}</ScriptTitle>
            {entriesError && <p className="text-sm text-over">{entriesError}</p>}
            {!entriesError && entries.length === 0 && <p className="text-sm text-muted">{t('noMovements')}</p>}
            <ul className="flex flex-col gap-2">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{e.note || t('unnamed')}</p>
                    <p className="text-xs text-muted">
                      {fmtDate(e.entry_date, i18n.language)}
                      {e.transfer_id && ` · ${t('tagTransfer')}`}
                      {e.source_expense_id && ` · ${t('tagRefund')}`}
                    </p>
                  </div>
                  <span className={`font-semibold tabular-nums ${e.amount < 0 ? 'text-over' : 'text-accent-strong'}`}>
                    {e.amount > 0 ? '+' : ''}
                    {money(e.amount)}
                  </span>
                  <ConfirmButton
                    label="✕"
                    ariaLabel={t('delete')}
                    confirmLabel={t('confirmDelete')}
                    className="no-print px-1 text-muted opacity-60 hover:text-over hover:opacity-100"
                    confirmClassName="no-print text-xs font-semibold text-over underline"
                    onConfirm={async () => {
                      // Un virement interne est composé de deux écritures: on retire les deux.
                      const q = supabase.from('savings_entries').delete()
                      await (e.transfer_id ? q.eq('transfer_id', e.transfer_id) : q.eq('id', e.id))
                      refresh()
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}

function Title({ envelope, onSaved }: { envelope: SavingsEnvelope; onSaved: () => void }) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(envelope.name)
  const [target, setTarget] = useState(envelope.target == null ? '' : String(envelope.target))
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const goal = target.trim() === '' ? null : parseAmount(target)
    if (!name.trim()) return setError(t('errNameRequired'))
    if (goal !== null && !(goal > 0)) return setError(t('errAmount'))
    const { error } = await supabase
      .from('savings_envelopes')
      .update({ name: name.trim(), target: goal })
      .eq('id', envelope.id)
    if (error) return setError(`${t('errSave')} (${error.message})`)
    setError(null)
    setEditing(false)
    onSaved()
  }

  if (!editing) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{envelope.name}</h1>
          {envelope.target && (
            <p className="text-sm text-muted">{t('goalOf', { amount: fmtMoney(envelope.target, i18n.language) })}</p>
          )}
        </div>
        <button
          onClick={() => {
            setName(envelope.name)
            setTarget(envelope.target == null ? '' : String(envelope.target))
            setEditing(true)
          }}
          className="no-print text-sm text-accent-strong underline"
        >
          {t('renameEdit')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-2">
      <input aria-label={t('savingsName')} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      <input
        inputMode="decimal"
        placeholder={t('savingsTargetOptional')}
        aria-label={t('savingsTargetOptional')}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className={INPUT}
      />
      {error && <p className="px-1 text-sm text-over">{error}</p>}
      <div className="flex gap-2">
        <button className={`flex-1 ${BUTTON}`}>{t('save')}</button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-xl bg-accent-soft px-4 py-2 text-accent-strong">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}

// Dépôt ou retrait sur le solde propre de l'enveloppe (« non réparti » pour une enveloppe mère).
function MovementForm({
  envelope,
  householdId,
  own,
  isPool,
  onDone,
}: {
  envelope: SavingsEnvelope
  householdId: string
  own: number
  isPool: boolean
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const value = round(parseAmount(amount))
    if (!(value > 0)) return setError(t('errAmount'))
    if (kind === 'withdraw' && value > own) return setError(t('errInsufficient'))
    setBusy(true)
    const { error } = await supabase.from('savings_entries').insert({
      household_id: householdId,
      savings_id: envelope.id,
      amount: kind === 'deposit' ? value : -value,
      note: note.trim() || null,
      entry_date: date || todayIso(),
    })
    setBusy(false)
    if (error) return setError(`${t('errSave')} (${error.message})`)
    setError(null)
    setAmount('')
    setNote('')
    setDate(todayIso())
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="no-print flex flex-col gap-2 rounded-2xl border border-dashed border-accent p-4">
      <h2 className="text-sm font-medium">{isPool ? t('newMoneyUnallocated') : t('newMovement')}</h2>
      <div className="flex gap-2">
        <div className="w-40 shrink-0">
          <Select
            variant="field"
            label={t('movementKind')}
            value={kind}
            options={[
              { value: 'deposit', label: t('deposit') },
              { value: 'withdraw', label: t('withdrawal') },
            ]}
            onChange={setKind}
          />
        </div>
        <input
          inputMode="decimal"
          placeholder="0,00"
          aria-label={t('amount')}
          aria-invalid={!!error}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={INPUT}
        />
      </div>
      <input placeholder={t('movementNote')} aria-label={t('movementNote')} value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
      <input type="date" aria-label={t('date')} value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
      {error && <p className="px-1 text-sm text-over">{error}</p>}
      <button disabled={busy} className={BUTTON}>
        {t('record')}
      </button>
    </form>
  )
}

// Sous-enveloppes (un seul niveau) et virements entre « non réparti » et les sous-enveloppes.
function SubEnvelopes({
  data,
  envelope,
  householdId,
  children,
  onChanged,
}: {
  data: SavingsData
  envelope: SavingsEnvelope
  householdId: string
  children: SavingsEnvelope[]
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const goal = target.trim() === '' ? null : parseAmount(target)
    if (!name.trim()) return setError(t('errNameRequired'))
    if (goal !== null && !(goal > 0)) return setError(t('errAmount'))
    const { error } = await supabase.from('savings_envelopes').insert({
      household_id: householdId,
      parent_id: envelope.id,
      name: name.trim(),
      target: goal,
      sort: children.length,
    })
    if (error) return setError(`${t('errSave')} (${error.message})`)
    setError(null)
    setName('')
    setTarget('')
    onChanged()
  }

  return (
    <section className="flex flex-col gap-3">
      <ScriptTitle>{t('subEnvelopes')}</ScriptTitle>
      {children.length === 0 && <p className="text-sm text-muted">{t('noSubEnvelopes')}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {children.map((c) => {
          const bal = data.own[c.id] ?? 0
          return (
            <a key={c.id} href={`#/savings/${c.id}`} className="block rounded-2xl border border-border bg-surface p-4 hover:border-accent">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-medium">{c.name}</h3>
                <span className="font-semibold tabular-nums text-accent-strong">{money(bal)}</span>
              </div>
              <div className="mt-3">
                <MilestoneBar balance={bal} target={c.target} milestones={milestonesOf(data, c.id)} format={money} />
              </div>
            </a>
          )
        })}
      </div>

      {children.length > 0 && <TransferForm data={data} envelope={envelope} householdId={householdId} children={children} onDone={onChanged} />}

      <form onSubmit={add} noValidate className="no-print flex flex-col gap-2 rounded-2xl border border-dashed border-accent p-4">
        <h3 className="text-sm font-medium">{t('addSubEnvelope')}</h3>
        <input placeholder={t('savingsName')} aria-label={t('savingsName')} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        <input
          inputMode="decimal"
          placeholder={t('savingsTargetOptional')}
          aria-label={t('savingsTargetOptional')}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={INPUT}
        />
        {error && <p className="px-1 text-sm text-over">{error}</p>}
        <button className={BUTTON}>{t('addSubEnvelope')}</button>
      </form>
    </section>
  )
}

function TransferForm({
  data,
  envelope,
  householdId,
  children,
  onDone,
}: {
  data: SavingsData
  envelope: SavingsEnvelope
  householdId: string
  children: SavingsEnvelope[]
  onDone: () => void
}) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const places = [
    { id: envelope.id, label: t('unallocated') },
    ...children.map((c) => ({ id: c.id, label: c.name })),
  ]
  const options = places.map((p) => ({ value: p.id, label: `${p.label} (${money(data.own[p.id] ?? 0)})` }))
  const [from, setFrom] = useState(envelope.id)
  const [to, setTo] = useState(children[0].id)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = round(parseAmount(amount))
    if (!(value > 0)) return setError(t('errAmount'))
    if (from === to) return setError(t('errSamePlace'))
    if (value > (data.own[from] ?? 0)) return setError(t('errInsufficient'))
    const label = (id: string) => places.find((p) => p.id === id)?.label ?? ''
    const transfer = crypto.randomUUID()
    const note = t('transferNote', { from: label(from), to: label(to) })
    const base = { household_id: householdId, note, entry_date: todayIso(), transfer_id: transfer }
    // Une seule requête: les deux écritures passent ensemble ou pas du tout.
    const { error } = await supabase.from('savings_entries').insert([
      { ...base, savings_id: from, amount: -value },
      { ...base, savings_id: to, amount: value },
    ])
    if (error) return setError(`${t('errSave')} (${error.message})`)
    setError(null)
    setAmount('')
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="no-print flex flex-col gap-2 rounded-2xl bg-accent-soft/50 p-4">
      <h3 className="text-sm font-medium">{t('transferTitle')}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select variant="field" label={t('transferFrom')} value={from} options={options} onChange={setFrom} />
        <Select variant="field" label={t('transferTo')} value={to} options={options} onChange={setTo} />
      </div>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          placeholder="0,00"
          aria-label={t('amount')}
          aria-invalid={!!error}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={INPUT}
        />
        <button className={`shrink-0 ${BUTTON}`}>{t('transfer')}</button>
      </div>
      {error && <p className="px-1 text-sm text-over">{error}</p>}
    </form>
  )
}

function Milestones({
  envelope,
  householdId,
  data,
  onChanged,
}: {
  envelope: SavingsEnvelope
  householdId: string
  data: SavingsData
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mine = data.milestones.filter((m) => m.savings_id === envelope.id).sort((a, b) => a.amount - b.amount)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const value = round(parseAmount(amount))
    if (!(value > 0)) return setError(t('errAmount'))
    const { error } = await supabase
      .from('savings_milestones')
      .insert({ household_id: householdId, savings_id: envelope.id, amount: value })
    if (error) return setError(error.code === '23505' ? t('errMilestoneExists') : `${t('errSave')} (${error.message})`)
    setError(null)
    setAmount('')
    onChanged()
  }

  return (
    <section className="flex flex-col gap-2">
      <ScriptTitle>{t('milestones')}</ScriptTitle>
      <p className="text-sm text-muted">{t('milestonesHint')}</p>
      <ul className="flex flex-wrap gap-2">
        {mine.map((m) => (
          <li key={m.id} className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-3 pr-2 text-sm">
            <span className="font-medium tabular-nums text-accent-strong">{fmtMoney(m.amount, i18n.language)}</span>
            <button
              aria-label={t('delete')}
              onClick={async () => {
                await supabase.from('savings_milestones').delete().eq('id', m.id)
                onChanged()
              }}
              className="no-print rounded-full px-1 text-muted hover:text-over"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} noValidate className="no-print flex gap-2">
        <input
          inputMode="decimal"
          placeholder={t('milestonePlaceholder')}
          aria-label={t('milestonePlaceholder')}
          aria-invalid={!!error}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={INPUT}
        />
        <button className="shrink-0 rounded-xl bg-accent-soft px-4 py-2 font-medium text-accent-strong">{t('add')}</button>
      </form>
      {error && <p className="px-1 text-sm text-over">{error}</p>}
    </section>
  )
}
