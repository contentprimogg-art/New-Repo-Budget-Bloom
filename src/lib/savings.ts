import { useCallback, useEffect, useState } from 'react'
import { useDataVersion } from './realtime'
import { todayIso } from './format'
import { supabase } from './supabase'
import type { ExpenseStatus } from './types'

export interface SavingsEnvelope {
  id: string
  household_id: string
  parent_id: string | null
  name: string
  target: number | null
  sort: number
  icon?: string | null
  color?: string | null
}

export interface Milestone {
  id: string
  savings_id: string
  amount: number
}

export interface SavingsEntry {
  id: string
  savings_id: string
  amount: number
  note: string | null
  entry_date: string
  source_expense_id: string | null
  transfer_id: string | null
}

export interface SavingsData {
  envelopes: SavingsEnvelope[]
  milestones: Milestone[]
  /** Solde propre de chaque enveloppe (somme de ses mouvements). */
  own: Record<string, number>
}

export async function loadSavings(householdId: string): Promise<{ data: SavingsData | null; error: string | null }> {
  const [env, ms, en] = await Promise.all([
    supabase
      .from('savings_envelopes')
      .select('*')
      .eq('household_id', householdId)
      .order('sort')
      .order('created_at'),
    supabase.from('savings_milestones').select('id, savings_id, amount').eq('household_id', householdId),
    supabase.from('savings_entries').select('savings_id, amount').eq('household_id', householdId),
  ])
  const failure = env.error ?? ms.error ?? en.error
  if (failure) return { data: null, error: failure.message }
  const own: Record<string, number> = {}
  for (const e of en.data ?? []) own[e.savings_id] = (own[e.savings_id] ?? 0) + Number(e.amount)
  return {
    data: {
      envelopes: (env.data ?? []).map((e) => ({ ...e, target: e.target == null ? null : Number(e.target) })),
      milestones: (ms.data ?? []).map((m) => ({ ...m, amount: Number(m.amount) })),
      own,
    },
    error: null,
  }
}

export function useSavings(householdId: string) {
  const [data, setData] = useState<SavingsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const result = await loadSavings(householdId)
    setData(result.data)
    setError(result.error)
    setLoaded(true)
  }, [householdId])

  const version = useDataVersion()
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload, version])

  return { data, error, loaded, reload }
}

export const childrenOf = (data: SavingsData, id: string) => data.envelopes.filter((e) => e.parent_id === id)

/** Total d'une enveloppe: son solde propre + celui de ses sous-enveloppes. */
export const totalOf = (data: SavingsData, id: string) =>
  (data.own[id] ?? 0) + childrenOf(data, id).reduce((sum, c) => sum + (data.own[c.id] ?? 0), 0)

export const milestonesOf = (data: SavingsData, id: string) =>
  data.milestones
    .filter((m) => m.savings_id === id)
    .map((m) => m.amount)
    .sort((a, b) => a - b)

/** Remboursement d'une dépense: change son statut et, si la somme est « mise de côté »,
 *  crédite l'enveloppe d'épargne choisie. Renvoie un message d'erreur, ou null. */
export async function settleExpense(args: {
  householdId: string
  expense: { id: string; amount: number; note: string | null }
  status: ExpenseStatus
  savingsId?: string | null
  fallbackNote: string
}): Promise<string | null> {
  const { householdId, expense, status, savingsId, fallbackNote } = args
  const upd = await supabase
    .from('expenses')
    .update({ status, settled_on: status === 'active' ? null : todayIso() })
    .eq('id', expense.id)
  if (upd.error) return upd.error.message
  // Toute écriture d'épargne liée à un ancien statut est remplacée.
  const del = await supabase.from('savings_entries').delete().eq('source_expense_id', expense.id)
  if (del.error) return del.error.message
  if (status === 'kept' && savingsId) {
    const ins = await supabase.from('savings_entries').insert({
      household_id: householdId,
      savings_id: savingsId,
      amount: expense.amount,
      note: expense.note ?? fallbackNote,
      entry_date: todayIso(),
      source_expense_id: expense.id,
    })
    if (ins.error) return ins.error.message
  }
  return null
}

/** Si le montant d'une dépense « mise de côté » change, l'écriture d'épargne liée suit. */
export async function syncLinkedAmount(expenseId: string, amount: number) {
  await supabase.from('savings_entries').update({ amount }).eq('source_expense_id', expenseId)
}
