export interface Envelope {
  id: string
  household_id: string
  month: string
  name: string
  kind: 'spending' | 'savings'
  parent_id: string | null
  budget: number
  color: string | null
  icon: string | null
  sort: number
  recurring: boolean
  group_id?: string | null
  /** Identifiant commun à « la même » enveloppe d'un mois à l'autre (migration 0008). */
  lineage_id?: string | null
  created_by?: string | null
}

export interface EnvelopeGroup {
  id: string
  household_id: string
  name: string
  sort: number
}

export interface Profile {
  firstName: string | null
  lastName: string | null
}

export type ExpenseStatus = 'active' | 'refunded' | 'kept'

export interface Expense {
  id: string
  envelope_id: string
  amount: number
  note: string | null
  spent_on: string
  status: ExpenseStatus
  settled_on: string | null
  created_by?: string | null
  recurring_id?: string | null
  /** Montant et devise de saisie quand la dépense a été faite dans une autre devise (migration 0009). */
  original_amount?: number | null
  original_currency?: string | null
  /** Vrai pour une dépense saisie hors-ligne, pas encore envoyée. */
  pending?: boolean
}

export interface RecurringExpense {
  id: string
  household_id: string
  lineage_id: string
  note: string | null
  amount: number
  every_months: 1 | 2 | 3 | 6 | 12
  day: number
  next_month: string
}

export interface Income {
  id: string
  household_id: string
  month: string
  label: string
  amount: number
  received_on: string
  recurring: boolean
  icon: string | null
  color: string | null
  created_by?: string | null
  pending?: boolean
}

// Une dépense remboursée « libérée » ne pèse plus sur l'enveloppe; « mise de côté » oui.
export const countsAsSpent = (status: ExpenseStatus) => status !== 'refunded'

export interface EnvelopeStats {
  spent: number
  remaining: number
  percent: number
  overBy: number
}

export function envelopeStats(budget: number, spent: number): EnvelopeStats {
  return {
    spent,
    remaining: budget - spent,
    percent: budget > 0 ? Math.round((spent / budget) * 100) : spent > 0 ? 100 : 0,
    overBy: Math.max(0, spent - budget),
  }
}

export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
