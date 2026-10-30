import { countsAsSpent, envelopeStats, type Envelope, type Expense } from './types'

export interface Tip {
  key: string
  params?: Record<string, string | number>
}

export interface Sibling {
  name: string
  remaining: number
}

// Règles simples (pas d'IA): chaque conseil s'appuie sur des chiffres réels de l'enveloppe.
export function envelopeTips(args: {
  envelope: Envelope
  expenses: Expense[]
  siblings: Sibling[]
  nowMonth: string
  today: Date
  unnamed: string
  money: (n: number) => string
}): Tip[] {
  const { envelope, expenses, siblings, nowMonth, today, unnamed, money } = args
  const counted = expenses.filter((e) => countsAsSpent(e.status))
  const spent = counted.reduce((sum, e) => sum + e.amount, 0)
  const stats = envelopeStats(envelope.budget, spent)
  const tips: Tip[] = []

  // Rythme: seulement sur le mois en cours, quand on dépense nettement plus vite que le calendrier.
  if (envelope.month === nowMonth && envelope.budget > 0) {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const elapsed = Math.round((today.getDate() / daysInMonth) * 100)
    if (stats.percent >= 70 && stats.percent - elapsed >= 20 && elapsed < 90) {
      tips.push({ key: 'tipPace', params: { percent: stats.percent, elapsed } })
    }
  }

  if (stats.overBy > 0) {
    const spare = siblings.filter((s) => s.remaining > 0).sort((a, b) => b.remaining - a.remaining)[0]
    if (spare) {
      tips.push({
        key: 'tipRealloc',
        params: { amount: money(Math.min(stats.overBy, spare.remaining)), name: spare.name },
      })
    }
    const biggest = [...counted].sort((a, b) => b.amount - a.amount)[0]
    if (biggest && counted.length >= 2 && biggest.amount / spent >= 0.4) {
      tips.push({
        key: 'tipBig',
        params: {
          label: biggest.note || unnamed,
          amount: money(biggest.amount),
          percent: Math.round((biggest.amount / spent) * 100),
        },
      })
    }
    if (expenses.some((e) => e.status === 'active')) tips.push({ key: 'tipRefund' })
    tips.push({ key: 'tipRaise', params: { amount: money(Math.ceil(spent / 5) * 5) } })
  }
  return tips
}

// Vue d'ensemble: pour chaque enveloppe dépassée, d'où pourrait venir la somme.
export function reallocTips(
  envelopes: { name: string; budget: number; spent: number }[],
  money: (n: number) => string,
): Tip[] {
  const spare = envelopes
    .map((e) => ({ name: e.name, remaining: e.budget - e.spent }))
    .filter((e) => e.remaining > 0)
  const over = envelopes
    .map((e) => ({ name: e.name, overBy: e.spent - e.budget }))
    .filter((e) => e.overBy > 0)
    .sort((a, b) => b.overBy - a.overBy)

  const tips: Tip[] = []
  for (const o of over) {
    spare.sort((a, b) => b.remaining - a.remaining)
    const source = spare[0]
    if (!source) {
      tips.push({ key: 'tipHomeNoSpare', params: { name: o.name, amount: money(o.overBy) } })
      continue
    }
    const moved = Math.min(o.overBy, source.remaining)
    tips.push({ key: 'tipHomeRealloc', params: { name: o.name, amount: money(moved), from: source.name } })
    source.remaining -= moved
  }
  return tips
}
