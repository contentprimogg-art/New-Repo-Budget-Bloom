import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney, parseAmount } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Envelope, EnvelopeStats } from '../lib/types'

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
    })
    setBusy(false)
    if (error) return setFormError(`${t('errSave')} (${error.message})`)
    setFormError(null)
    setNote('')
    setAmount('')
    onChange()
  }

  return (
    <section className="fade-up rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* Tout le haut de la bande ouvre le détail; la saisie rapide reste en dessous. */}
      <button
        type="button"
        onClick={() => {
          window.location.hash = `#/envelope/${envelope.id}`
        }}
        className="block w-full text-left"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">
            {envelope.name}
            {envelope.recurring && (
              <span title={t('recurringLabel')} aria-label={t('recurringLabel')} className="ml-1.5 text-xs text-muted">
                ↻
              </span>
            )}
          </h2>
          <span className={`text-sm font-semibold ${over ? 'text-over' : 'text-accent-strong'}`}>
            {stats.percent}%
          </span>
        </div>
        <div className="my-3 h-2.5 overflow-hidden rounded-full bg-accent-soft">
          <div
            className={`h-full rounded-full ${over ? 'bg-over' : 'bg-accent'}`}
            style={{ width: `${Math.min(100, stats.percent)}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-muted">
          <span>
            {t('spent')} {money(stats.spent)} / {money(envelope.budget)}
          </span>
          <span className={over ? 'font-semibold text-over' : ''}>
            {over ? t('overBy', { amount: money(stats.overBy) }) : `${t('remaining')} ${money(stats.remaining)}`}
          </span>
        </div>
      </button>
      <form onSubmit={add} noValidate className="no-print mt-3 flex flex-col gap-2">
        <input
          placeholder={t('transactionName')}
          aria-label={t('transactionName')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-border px-3 py-2"
        />
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            placeholder="0,00"
            aria-label={t('amount')}
            aria-invalid={invalid}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2"
          />
          <button
            disabled={busy}
            aria-label={t('addExpense')}
            className="rounded-xl bg-accent-soft px-4 py-2 font-medium text-accent-strong"
          >
            +
          </button>
        </div>
        {formError && <p className="px-1 text-sm text-over">{formError}</p>}
      </form>
    </section>
  )
}
