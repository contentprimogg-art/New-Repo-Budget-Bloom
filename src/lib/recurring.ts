import { supabase } from './supabase'
import type { Envelope } from './types'
import { shiftMonth } from './types'
import { uuid } from './uuid'

export const FREQUENCIES = [1, 2, 3, 6, 12] as const
export type Frequency = (typeof FREQUENCIES)[number]

/** Lignée d'une enveloppe: commune à ses copies des mois suivants (repli sur l'identifiant avant la migration 0008). */
export const lineageOf = (envelope: Envelope) => envelope.lineage_id ?? envelope.id

// Crée le modèle d'une dépense récurrente à partir d'une dépense du mois: elle sera recréée
// automatiquement dans « la même » enveloppe tous les N mois (au premier chargement du mois concerné).
export async function makeRecurring(args: {
  envelope: Envelope
  expense: { id?: string; note: string | null; amount: number; spent_on: string }
  every: Frequency
}): Promise<{ templateId: string | null; error: string | null }> {
  const { envelope, expense, every } = args
  const id = uuid()
  const { error } = await supabase.from('recurring_expenses').insert({
    id,
    household_id: envelope.household_id,
    lineage_id: lineageOf(envelope),
    note: expense.note,
    amount: expense.amount,
    every_months: every,
    day: Number(expense.spent_on.slice(8, 10)) || 1,
    next_month: shiftMonth(expense.spent_on.slice(0, 7), every),
  })
  if (error) return { templateId: null, error: error.message }
  if (expense.id) await supabase.from('expenses').update({ recurring_id: id }).eq('id', expense.id)
  return { templateId: id, error: null }
}
