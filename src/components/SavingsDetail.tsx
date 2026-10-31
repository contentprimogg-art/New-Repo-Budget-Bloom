import { ChevronLeft, Pencil, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtDate, fmtMoney, parseAmount, todayIso } from '../lib/format'
import { IconBadge, colorForIndex } from '../lib/icons'
import { useDataVersion } from '../lib/realtime'
import { childrenOf, milestonesOf, totalOf, type SavingsData, type SavingsEntry, type SavingsEnvelope } from '../lib/savings'
import { supabase } from '../lib/supabase'
import { uuid } from '../lib/uuid'
import ConfirmButton from './ConfirmButton'
import MilestoneBar from './MilestoneBar'
import ScriptTitle from './ScriptTitle'
import Select from './Select'
import SavingsSheet from './savings/SavingsSheet'
import Field, { SECONDARY } from './ui/Field'
import Card from './ui/Card'
import { IconButton } from './ui/PageHeader'
import PageShell from './ui/PageShell'
import SummaryColumns from './ui/SummaryColumns'

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
  const lng = i18n.language
  const money = (n: number) => fmtMoney(n, lng)
  const version = useDataVersion()
  const parent = envelope.parent_id ? data.envelopes.find((e) => e.id === envelope.parent_id) : undefined
  const children = childrenOf(data, envelope.id)
  const total = totalOf(data, envelope.id)
  const own = data.own[envelope.id] ?? 0
  const milestones = milestonesOf(data, envelope.id)
  const goal = envelope.target ?? (milestones.length ? Math.max(...milestones) : null)
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'edit' | 'child' | null>(null)

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
  }, [loadEntries, version])

  const refresh = () => {
    void loadEntries()
    reload()
  }

  const backHref = parent ? `#/savings/${parent.id}` : '#/savings'

  return (
    <PageShell
      wide
      title={envelope.name}
      left={
        <IconButton label={parent ? parent.name : t('back')} href={backHref}>
          <ChevronLeft size={22} />
        </IconButton>
      }
      subtitle={
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
          {parent ? parent.name : t('tabSavings')}
          {envelope.target ? ` · ${t('goalOf', { amount: money(envelope.target) })}` : ''}
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
            <div className="flex flex-col gap-5">
              <div className="flex justify-center">
                <IconBadge icon={envelope.icon ?? 'piggy'} color={envelope.color} size="lg" />
              </div>
              <SummaryColumns
                items={[
                  { label: children.length ? t('totalShort') : t('savedSoFar'), value: money(total), tone: 'var(--accent-strong)' },
                  { label: t('goalShort'), value: goal ? money(goal) : '—', tone: 'var(--chart-2)' },
                  { label: t('leftShort'), value: goal ? money(Math.max(goal - total, 0)) : '—', tone: 'var(--ok)' },
                ]}
              />
              <MilestoneBar balance={total} target={envelope.target} milestones={milestones} format={money} />
              {children.length > 0 && (
                <p className={`text-center text-sm ${own < 0 ? 'font-medium text-over' : 'text-muted'}`}>
                  {t('unallocated')}: <span className="font-medium tabular-nums">{money(own)}</span>
                  {own < 0 && ` · ${t('overAllocated')}`}
                </p>
              )}
            </div>
          </Card>

          <MovementForm envelope={envelope} householdId={householdId} own={own} isPool={children.length > 0} onDone={refresh} />
        </div>

        <div className="flex flex-col gap-6">
          {!parent && (
            <SubEnvelopes data={data} envelope={envelope} householdId={householdId} kids={children} onAdd={() => setSheet('child')} onChanged={refresh} />
          )}
          <Milestones envelope={envelope} householdId={householdId} data={data} onChanged={reload} />
          <section className="flex flex-col gap-3">
            <ScriptTitle>{t('movements')}</ScriptTitle>
            {entriesError && <p className="text-sm text-over">{entriesError}</p>}
            {!entriesError && entries.length === 0 && <Card description={t('noMovements')} />}
            {entries.length > 0 && (
              <Card>
                <ul className="-my-2 divide-y divide-dashed divide-muted/30">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px]">{e.note || t('unnamed')}</p>
                        <p className="text-xs text-muted">
                          {fmtDate(e.entry_date, lng)}
                          {e.transfer_id && ` · ${t('tagTransfer')}`}
                          {e.source_expense_id && ` · ${t('tagRefund')}`}
                        </p>
                      </div>
                      <span className={`text-[15px] font-medium tabular-nums ${e.amount < 0 ? 'text-over' : 'text-ok-ink'}`}>
                        {e.amount > 0 ? '+' : ''}
                        {money(e.amount)}
                      </span>
                      <ConfirmButton
                        label={<X size={16} />}
                        ariaLabel={t('delete')}
                        confirmLabel={t('confirmDelete')}
                        className="no-print rounded-full p-1 text-muted opacity-60 hover:text-over hover:opacity-100"
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
              </Card>
            )}
          </section>
        </div>
      </div>

      {sheet === 'edit' && (
        <SavingsSheet
          householdId={householdId}
          envelope={envelope}
          defaultColor={envelope.color ?? colorForIndex(0)}
          sort={envelope.sort}
          hasChildren={children.length > 0}
          onClose={() => setSheet(null)}
          onSaved={reload}
          onDeleted={() => {
            reload()
            window.location.hash = backHref
          }}
        />
      )}
      {sheet === 'child' && (
        <SavingsSheet
          householdId={householdId}
          parentId={envelope.id}
          defaultColor={colorForIndex(children.length + 2)}
          sort={children.length}
          onClose={() => setSheet(null)}
          onSaved={reload}
        />
      )}
    </PageShell>
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
    <form onSubmit={submit} noValidate className="no-print flex flex-col gap-3 rounded-3xl border border-border/80 bg-surface p-5 shadow-[0_1px_2px_rgb(26_29_32/0.04)]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{isPool ? t('newMoneyUnallocated') : t('newMovement')}</p>
      <div role="radiogroup" aria-label={t('movementKind')} className="flex gap-2">
        {(['deposit', 'withdraw'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${kind === k ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-muted'}`}
          >
            {k === 'deposit' ? t('deposit') : t('withdrawal')}
          </button>
        ))}
      </div>
      <Field label={t('amount')} error={error}>
        <input inputMode="decimal" placeholder="0,00" aria-invalid={!!error} value={amount} onChange={(e) => setAmount(e.target.value)} className="field-line text-lg tabular-nums" />
      </Field>
      <Field label={t('movementNote')}>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="field-line" />
      </Field>
      <Field label={t('date')}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-line" />
      </Field>
      <button disabled={busy} className="rounded-full bg-accent-strong px-5 py-2.5 font-semibold text-on-accent">
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
  kids,
  onAdd,
  onChanged,
}: {
  data: SavingsData
  envelope: SavingsEnvelope
  householdId: string
  kids: SavingsEnvelope[]
  onAdd: () => void
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <ScriptTitle>{t('subEnvelopes')}</ScriptTitle>
        <button onClick={onAdd} className="no-print mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
          <Plus size={14} /> {t('add')}
        </button>
      </div>
      {kids.length === 0 && <Card description={t('noSubEnvelopes')} />}
      {kids.length > 0 && (
      <Card>
      <ul className="-my-2 divide-y divide-dashed divide-muted/30">
        {kids.map((c) => {
          const bal = data.own[c.id] ?? 0
          return (
            <li key={c.id}>
              <a href={`#/savings/${c.id}`} className="flex flex-col gap-2.5 py-3.5">
                <div className="flex items-center gap-3">
                  <IconBadge icon={c.icon ?? 'piggy'} color={c.color} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{c.name}</span>
                  <span className="text-[15px] font-medium tabular-nums">{money(bal)}</span>
                </div>
                <MilestoneBar balance={bal} target={c.target} milestones={milestonesOf(data, c.id)} format={money} />
              </a>
            </li>
          )
        })}
      </ul>
      </Card>
      )}
      {kids.length > 0 && <TransferForm data={data} envelope={envelope} householdId={householdId} kids={kids} onDone={onChanged} />}
    </section>
  )
}

function TransferForm({
  data,
  envelope,
  householdId,
  kids,
  onDone,
}: {
  data: SavingsData
  envelope: SavingsEnvelope
  householdId: string
  kids: SavingsEnvelope[]
  onDone: () => void
}) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const places = [{ id: envelope.id, label: t('unallocated') }, ...kids.map((c) => ({ id: c.id, label: c.name }))]
  const options = places.map((p) => ({ value: p.id, label: `${p.label} (${money(data.own[p.id] ?? 0)})` }))
  const [from, setFrom] = useState(envelope.id)
  const [to, setTo] = useState(kids[0].id)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = round(parseAmount(amount))
    if (!(value > 0)) return setError(t('errAmount'))
    if (from === to) return setError(t('errSamePlace'))
    if (value > (data.own[from] ?? 0)) return setError(t('errInsufficient'))
    const label = (id: string) => places.find((p) => p.id === id)?.label ?? ''
    const base = {
      household_id: householdId,
      note: t('transferNote', { from: label(from), to: label(to) }),
      entry_date: todayIso(),
      transfer_id: uuid(),
    }
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
    <form onSubmit={submit} noValidate className="no-print mt-2 flex flex-col gap-3 rounded-3xl border border-border/80 bg-surface p-5 shadow-[0_1px_2px_rgb(26_29_32/0.04)]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{t('transferTitle')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select variant="field" label={t('transferFrom')} value={from} options={options} onChange={setFrom} />
        <Select variant="field" label={t('transferTo')} value={to} options={options} onChange={setTo} />
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Field label={t('amount')} error={error}>
            <input inputMode="decimal" placeholder="0,00" aria-invalid={!!error} value={amount} onChange={(e) => setAmount(e.target.value)} className="field-line tabular-nums" />
          </Field>
        </div>
        <button className={SECONDARY}>{t('transfer')}</button>
      </div>
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
    const { error } = await supabase.from('savings_milestones').insert({ household_id: householdId, savings_id: envelope.id, amount: value })
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
          <li key={m.id} className="flex items-center gap-1 rounded-full border border-accent/60 py-1 pl-3 pr-1.5 text-sm">
            <span className="font-medium tabular-nums text-accent-strong">{fmtMoney(m.amount, i18n.language)}</span>
            <button
              aria-label={t('delete')}
              onClick={async () => {
                await supabase.from('savings_milestones').delete().eq('id', m.id)
                onChanged()
              }}
              className="no-print rounded-full p-0.5 text-muted hover:text-over"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} noValidate className="no-print flex items-end gap-3">
        <div className="flex-1">
          <Field label={t('milestonePlaceholder')} error={error}>
            <input inputMode="decimal" placeholder="0,00" aria-invalid={!!error} value={amount} onChange={(e) => setAmount(e.target.value)} className="field-line tabular-nums" />
          </Field>
        </div>
        <button className={SECONDARY}>{t('add')}</button>
      </form>
    </section>
  )
}
