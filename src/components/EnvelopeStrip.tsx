import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultDateFor, fmtMoney, parseAmount } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Envelope, EnvelopeStats } from '../lib/types'
import { EnvelopeBadge } from './IconPicker'

// Bande d'enveloppe: pastille + nom, « dépensé (pourcentage) » à gauche et budget à droite,
// barre de progression, puis « Restant » ou « Dépassé de ».
export default function EnvelopeStrip({
  envelope,
  stats,
  onChange,
}: {
  envelope: Envelope
  stats: EnvelopeStats
  onChange: () => void
}) {
  const { t, i18n } = useTranslation()
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const over = stats.overBy > 0
  const money = (n: number) => fmtMoney(n, i18n.language)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!(value > 0)) return setInvalid(true)
    setInvalid(false)
    if (busy) return
    setBusy(true)
    const { error } = await supabase.from('expenses').insert({
      household_id: envelope.household_id,
      envelope_id: envelope.id,
      amount: value,
      note: note.trim() || null,
      spent_on: defaultDateFor(envelope.month),
    })
    setBusy(false)
    if (error) return setFormError(`${t('errSave')} (${error.message})`)
    setFormError(null)
    setNote('')
    setAmount('')
    setOpen(false)
    onChange()
  }

  return (
    <section className="fade-up rounded-3xl border border-border bg-surface p-4 shadow-sm">
      <button
        type="button"
        onClick={() => {
          window.location.hash = `#/envelope/${envelope.id}`
        }}
        className="block w-full text-left"
      >
        <div className="flex items-center gap-3">
          <EnvelopeBadge icon={envelope.icon} color={envelope.color} />
          <h2 className="min-w-0 flex-1 truncate font-medium">
            {envelope.name}
            {envelope.recurring && (
              <span title={t('recurringLabel')} aria-label={t('recurringLabel')} className="ml-1.5 text-xs text-muted">
                ↻
              </span>
            )}
          </h2>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <p>
            <span className={`text-lg font-semibold tabular-nums ${over ? 'text-over' : ''}`}>{money(stats.spent)}</span>{' '}
            <span className="text-sm text-muted">({stats.percent}%)</span>
          </p>
          <p className="text-sm tabular-nums text-muted">{money(envelope.budget)}</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-accent-soft">
          <div
            className={`h-full rounded-full ${over ? 'bg-over' : 'bg-accent-strong'}`}
            style={{ width: `${Math.min(100, stats.percent)}%` }}
          />
        </div>
        <p className={`mt-2 text-sm ${over ? 'font-semibold text-over' : 'text-muted'}`}>
          {over ? t('overBy', { amount: money(stats.overBy) }) : `${t('remaining')} : ${money(stats.remaining)}`}
        </p>
      </button>

      <div className="no-print mt-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-full bg-accent-soft px-3.5 py-1.5 text-sm font-medium text-accent-strong"
        >
          {open ? t('close') : `+ ${t('addExpense')}`}
        </button>
        {open && (
          <form onSubmit={add} noValidate className="fade-up mt-3 flex flex-col gap-2">
            <input
              autoFocus
              placeholder={t('transactionName')}
              aria-label={t('transactionName')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-2xl border border-border px-3 py-2"
            />
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                placeholder="0,00"
                aria-label={t('amount')}
                aria-invalid={invalid}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-border px-3 py-2"
              />
              <button
                disabled={busy}
                aria-label={t('addExpense')}
                className="rounded-full bg-accent-strong px-5 py-2 font-medium text-white"
              >
                {t('add')}
              </button>
            </div>
            {formError && <p className="px-1 text-sm text-over">{formError}</p>}
          </form>
        )}
      </div>
    </section>
  )
}
