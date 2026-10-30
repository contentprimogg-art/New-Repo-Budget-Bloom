import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultDateFor, fmtMoney, parseAmount } from '../lib/format'
import { settleExpense, syncLinkedAmount } from '../lib/savings'
import { supabase } from '../lib/supabase'
import { countsAsSpent, type Envelope, type Expense, type ExpenseStatus } from '../lib/types'
import KeepDialog from './KeepDialog'
import Select, { type Align } from './Select'

type Col = 'note' | 'date' | 'amount' | 'status'
type Aligns = Record<Col, Align>

const ALIGN_KEY = 'tableAlign'
const DEFAULT_ALIGNS: Aligns = { note: 'left', date: 'left', amount: 'right', status: 'left' }
const NEXT_ALIGN: Record<Align, Align> = { left: 'center', center: 'right', right: 'left' }
const TEXT_ALIGN: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' }
const JUSTIFY: Record<Align, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

function readAligns(): Aligns {
  try {
    const raw = JSON.parse(localStorage.getItem(ALIGN_KEY) ?? '{}') as Partial<Aligns>
    const valid = (a: unknown): a is Align => a === 'left' || a === 'center' || a === 'right'
    const out = { ...DEFAULT_ALIGNS }
    for (const c of Object.keys(out) as Col[]) if (valid(raw[c])) out[c] = raw[c]
    return out
  } catch {
    return DEFAULT_ALIGNS
  }
}

// Petit pictogramme: trois traits alignés comme le texte de la colonne.
function AlignIcon({ align }: { align: Align }) {
  const lines: Record<Align, [number, number][]> = {
    left: [[1, 11], [1, 7], [1, 10]],
    center: [[1, 11], [3, 9], [1.5, 10.5]],
    right: [[1, 11], [5, 11], [2, 11]],
  }
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="size-3.5">
      {lines[align].map(([x1, x2], i) => (
        <line key={i} x1={x1} x2={x2} y1={3 + i * 3} y2={3 + i * 3} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ))}
    </svg>
  )
}

const CELL = 'w-full rounded-lg border border-transparent bg-transparent px-2.5 py-2 tabular-nums'

// Cellule modifiable façon tableur: on tape, Entrée valide et descend, Échap annule, Tab passe à la suivante.
function Cell({
  value,
  row,
  col,
  label,
  type = 'text',
  align,
  muted,
  onCommit,
  onEnter,
}: {
  value: string
  row: number
  col: Col
  label: string
  type?: 'text' | 'date'
  align: Align
  muted?: boolean
  onCommit: (next: string) => boolean
  onEnter: (row: number, col: Col) => void
}) {
  const [draft, setDraft] = useState(value)
  const committed = useRef(value)

  function commit() {
    if (draft === committed.current) return
    if (onCommit(draft)) committed.current = draft
    else setDraft(committed.current)
  }

  return (
    <input
      data-row={row}
      data-col={col}
      type={type}
      inputMode={col === 'amount' ? 'decimal' : undefined}
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          onEnter(row, col)
        } else if (e.key === 'Escape') {
          setDraft(committed.current)
          e.currentTarget.blur()
        }
      }}
      className={`${CELL} ${TEXT_ALIGN[align]} ${muted ? 'text-muted line-through' : ''}`}
    />
  )
}

export default function EnvelopeTable({
  envelope,
  expenses,
  onChanged,
}: {
  envelope: Envelope
  expenses: Expense[]
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [keeping, setKeeping] = useState<Expense | null>(null)
  const [aligns, setAligns] = useState<Aligns>(readAligns)

  function cycleAlign(col: Col) {
    const next = { ...aligns, [col]: NEXT_ALIGN[aligns[col]] }
    setAligns(next)
    try {
      localStorage.setItem(ALIGN_KEY, JSON.stringify(next))
    } catch {
      /* stockage indisponible: l'alignement ne sera pas mémorisé */
    }
  }

  // Ordre chronologique (le plus ancien en premier), comme dans un tableur.
  const rows = [...expenses].reverse()
  const total = rows.reduce((sum, e) => (countsAsSpent(e.status) ? sum + e.amount : sum), 0)

  const goDown = (row: number, col: Col) =>
    root.current?.querySelector<HTMLElement>(`[data-row="${row + 1}"][data-col="${col}"]`)?.focus()

  async function run(op: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await op
    if (error) setError(`${t('errSave')} (${error.message})`)
    else {
      setError(null)
      onChanged()
    }
  }

  const patch = (id: string, values: Record<string, unknown>) =>
    run(supabase.from('expenses').update(values).eq('id', id))

  async function setStatus(e: Expense, status: ExpenseStatus, savingsId?: string | null) {
    const failure = await settleExpense({
      householdId: envelope.household_id,
      expense: e,
      status,
      savingsId,
      fallbackNote: t('refundedKeptNote'),
    })
    if (failure) setError(`${t('errSave')} (${failure})`)
    else {
      setError(null)
      onChanged()
    }
  }

  const remove = (id: string) => {
    setConfirmId(null)
    return run(supabase.from('expenses').delete().eq('id', id))
  }

  const statusOptions: { value: ExpenseStatus; label: string }[] = [
    { value: 'active', label: t('statusActive') },
    { value: 'refunded', label: t('statusFreed') },
    { value: 'kept', label: t('statusKept') },
  ]

  const headers: [Col, string, string][] = [
    ['note', t('colLabel'), ''],
    ['date', t('date'), 'w-44'],
    ['amount', t('amount'), 'w-36'],
    ['status', t('colStatus'), 'w-52'],
  ]
  const alignName = (a: Align) => t(a === 'left' ? 'alignLeft' : a === 'center' ? 'alignCenter' : 'alignRight')

  return (
    <div ref={root} className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-xl bg-over/10 px-3 py-2 text-sm text-over">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="w-full min-w-176 border-collapse text-sm">
          <thead>
            <tr className="bg-accent-soft text-xs uppercase tracking-wide text-accent-strong">
              <th className="w-12 px-3 py-2.5 text-center font-medium">{t('colNumber')}</th>
              {headers.map(([col, label, width]) => (
                <th key={col} className={`px-4 py-2.5 font-medium ${width}`}>
                  <div className={`flex items-center gap-1.5 ${JUSTIFY[aligns[col]]}`}>
                    <span>{label}</span>
                    <button
                      onClick={() => cycleAlign(col)}
                      aria-label={t('alignTitle', { col: label, current: alignName(aligns[col]) })}
                      title={t('alignTitle', { col: label, current: alignName(aligns[col]) })}
                      className="no-print rounded-md p-1 opacity-60 hover:bg-surface hover:opacity-100"
                    >
                      <AlignIcon align={aligns[col]} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="no-print w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const settled = e.status !== 'active'
              return (
                <tr key={e.id} className="group border-t border-border hover:bg-accent-soft/40">
                  <td className="select-none px-3 text-center text-xs text-muted">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <Cell
                      key={`note-${e.note}`}
                      value={e.note ?? ''}
                      row={i}
                      col="note"
                      label={t('colLabel')}
                      align={aligns.note}
                      muted={settled}
                      onCommit={(v) => {
                        void patch(e.id, { note: v.trim() || null })
                        return true
                      }}
                      onEnter={goDown}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Cell
                      key={`date-${e.spent_on}`}
                      value={e.spent_on}
                      row={i}
                      col="date"
                      type="date"
                      label={t('date')}
                      align={aligns.date}
                      muted={settled}
                      onCommit={(v) => {
                        if (!v) return false
                        void patch(e.id, { spent_on: v })
                        return true
                      }}
                      onEnter={goDown}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Cell
                      key={`amount-${e.amount}`}
                      value={String(e.amount)}
                      row={i}
                      col="amount"
                      label={t('amount')}
                      align={aligns.amount}
                      muted={settled}
                      onCommit={(v) => {
                        const n = parseAmount(v)
                        if (!(n > 0)) {
                          setError(t('errAmount'))
                          return false
                        }
                        void patch(e.id, { amount: n }).then(() => syncLinkedAmount(e.id, n))
                        return true
                      }}
                      onEnter={goDown}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select
                      data-row={i}
                      data-col="status"
                      label={t('colStatus')}
                      value={e.status}
                      options={statusOptions}
                      align={aligns.status}
                      onChange={(status) => (status === 'kept' ? setKeeping(e) : void setStatus(e, status))}
                      className={settled ? 'font-medium text-accent-strong' : 'text-muted'}
                    />
                  </td>
                  <td className="no-print px-1 text-center">
                    {confirmId === e.id ? (
                      <button
                        autoFocus
                        onClick={() => void remove(e.id)}
                        onBlur={() => setConfirmId(null)}
                        className="rounded-md px-1.5 text-xs font-semibold text-over"
                      >
                        {t('confirmDelete')}
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmId(e.id)}
                        aria-label={t('delete')}
                        className="rounded-md px-2 py-1 text-muted opacity-40 hover:text-over focus:opacity-100 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            <NewRow
              envelope={envelope}
              row={rows.length}
              aligns={aligns}
              onAdded={() => {
                onChanged()
                setError(null)
              }}
              onError={setError}
            />
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-accent-soft/40 text-sm font-semibold">
              <td />
              <td className="px-4 py-3" colSpan={2}>
                {t('totalCounted')}
              </td>
              <td className={`px-4 py-3 tabular-nums ${TEXT_ALIGN[aligns.amount]}`}>{fmtMoney(total, i18n.language)}</td>
              <td colSpan={2} className="px-4 py-3 text-xs font-normal text-muted">
                {t('budget')} {fmtMoney(envelope.budget, i18n.language)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="no-print px-1 text-xs text-muted">{t('tableHint')}</p>
      {keeping && (
        <KeepDialog
          householdId={envelope.household_id}
          onChoose={(savingsId) => {
            void setStatus(keeping, 'kept', savingsId)
            setKeeping(null)
          }}
          onCancel={() => setKeeping(null)}
        />
      )}
    </div>
  )
}

// Ligne vide en bas: Entrée sur le montant ajoute la ligne.
function NewRow({
  envelope,
  row,
  aligns,
  onAdded,
  onError,
}: {
  envelope: Envelope
  row: number
  aligns: Aligns
  onAdded: () => void
  onError: (message: string | null) => void
}) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [date, setDate] = useState(defaultDateFor(envelope.month))
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const noteRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (busy) return
    const value = parseAmount(amount)
    if (!(value > 0)) return onError(t('errAmount'))
    setBusy(true)
    const { error } = await supabase.from('expenses').insert({
      household_id: envelope.household_id,
      envelope_id: envelope.id,
      amount: value,
      note: note.trim() || null,
      spent_on: date || defaultDateFor(envelope.month),
    })
    setBusy(false)
    if (error) return onError(`${t('errSave')} (${error.message})`)
    setNote('')
    setAmount('')
    noteRef.current?.focus()
    onAdded()
  }

  const onKey = (col: Col) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    // Entrée sur le libellé ou la date passe à la cellule suivante; sur le montant, ajoute la ligne.
    if (col === 'note') document.querySelector<HTMLElement>(`[data-row="${row}"][data-col="date"]`)?.focus()
    else if (col === 'date') document.querySelector<HTMLElement>(`[data-row="${row}"][data-col="amount"]`)?.focus()
    else void submit()
  }

  return (
    <tr className="no-print border-t border-dashed border-accent/60">
      <td className="select-none px-3 text-center text-xs text-accent-strong">+</td>
      <td className="px-2 py-1.5">
        <input
          ref={noteRef}
          data-row={row}
          data-col="note"
          aria-label={t('transactionName')}
          placeholder={t('transactionName')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={onKey('note')}
          className={`${CELL} ${TEXT_ALIGN[aligns.note]}`}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          data-row={row}
          data-col="date"
          type="date"
          aria-label={t('date')}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onKeyDown={onKey('date')}
          className={`${CELL} ${TEXT_ALIGN[aligns.date]}`}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          data-row={row}
          data-col="amount"
          inputMode="decimal"
          aria-label={t('amount')}
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={onKey('amount')}
          className={`${CELL} ${TEXT_ALIGN[aligns.amount]}`}
        />
      </td>
      <td colSpan={2} className="px-4">
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-lg bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-strong"
        >
          {t('add')}
        </button>
      </td>
    </tr>
  )
}
