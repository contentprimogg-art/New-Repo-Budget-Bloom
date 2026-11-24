import { supabase } from './supabase'
import type { Envelope, Income } from './types'

// Mois à venir: tant qu'un mois n'est pas préparé, ses enveloppes et revenus récurrents sont affichés
// « prévus », calculés à partir du dernier mois existant (rien n'est enregistré). Toucher l'un d'eux
// prépare le mois pour de bon. Les dépenses récurrentes, elles, ne sont ajoutées qu'à l'arrivée du
// mois: d'ici là, elles comptent comme prévues dans leur enveloppe.

const monthIndex = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return y * 12 + m - 1
}

/** Vrai si une récurrence (prochaine échéance, tous les N mois) tombe sur ce mois. */
export function isDue(nextMonth: string, every: number, month: string) {
  const gap = monthIndex(month) - monthIndex(nextMonth)
  return gap >= 0 && gap % every === 0
}

function dayInMonth(month: string, day: number) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`
}

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export async function loadForecast(householdId: string, month: string, realEnvelopes: Envelope[], realIncomes: Income[], prepared: boolean) {
  const latest = async (table: 'envelopes' | 'incomes') => {
    const { data } = await supabase.from(table).select('month').eq('household_id', householdId).lt('month', month).order('month', { ascending: false }).limit(1).maybeSingle()
    return (data?.month as string | undefined) ?? null
  }
  const [envMonth, incomeMonth, recurring] = await Promise.all([
    latest('envelopes'),
    latest('incomes'),
    supabase.from('recurring_expenses').select('lineage_id, amount, every_months, next_month').eq('household_id', householdId),
  ])
  const [baseEnvelopes, baseIncomes] = await Promise.all([
    envMonth && !prepared
      ? supabase.from('envelopes').select('*').eq('household_id', householdId).eq('month', envMonth).eq('recurring', true).is('parent_id', null).order('sort')
      : null,
    incomeMonth && !prepared ? supabase.from('incomes').select('*').eq('household_id', householdId).eq('month', incomeMonth).eq('recurring', true) : null,
  ])

  const envelopes: Envelope[] = ((baseEnvelopes?.data ?? []) as Envelope[])
    .filter((e) => !realEnvelopes.some((x) => (e.lineage_id && x.lineage_id === e.lineage_id) || sameName(x.name, e.name)))
    .map((e) => ({ ...e, id: `forecast:${e.lineage_id ?? e.id}`, month, budget: Number(e.budget), forecast: true }))

  // Dépenses récurrentes prévues, dans l'enveloppe réelle ou prévue de leur lignée.
  const planned: Record<string, number> = {}
  for (const r of recurring.data ?? []) {
    if (!isDue(r.next_month as string, Number(r.every_months), month)) continue
    const target = [...realEnvelopes, ...envelopes].find((e) => e.lineage_id === r.lineage_id)
    if (target) planned[target.id] = (planned[target.id] ?? 0) + Number(r.amount)
  }

  const incomes: Income[] = ((baseIncomes?.data ?? []) as Income[])
    .filter((i) => !realIncomes.some((x) => sameName(x.label, i.label)))
    .map((i) => ({
      ...i,
      id: `forecast:${i.id}`,
      month,
      amount: Number(i.amount),
      received_on: dayInMonth(month, Number(i.received_on.slice(8, 10))),
      forecast: true,
    }))

  return { envelopes, incomes, planned }
}
