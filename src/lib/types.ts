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

export const currentMonth = () => new Date().toISOString().slice(0, 7)
