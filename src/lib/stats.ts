import { supabase } from './supabase'
import { countsAsSpent, type Envelope, type ExpenseStatus } from './types'

export interface StatExpense {
  id: string
  amount: number
  note: string | null
  spent_on: string
  status: ExpenseStatus
}

export type StatEnvelope = Envelope & { expenses: StatExpense[] }

export interface Balance {
  start: number | null
  end: number | null
}

export async function listMonths(householdId: string): Promise<{ months: string[]; error: string | null }> {
  const { data, error } = await supabase.from('envelopes').select('month').eq('household_id', householdId)
  if (error) return { months: [], error: error.message }
  return { months: [...new Set((data ?? []).map((r) => r.month as string))].sort(), error: null }
}

export async function loadStats(
  householdId: string,
  months: string[],
): Promise<{ envelopes: StatEnvelope[]; balances: Record<string, Balance>; incomes: Record<string, number>; error: string | null }> {
  if (months.length === 0) return { envelopes: [], balances: {}, incomes: {}, error: null }
  const [env, bal] = await Promise.all([
    supabase
      .from('envelopes')
      .select('*, expenses(id, amount, note, spent_on, status)')
      .eq('household_id', householdId)
      .in('month', months)
      .order('month')
      .order('sort')
      .order('created_at'),
    supabase
      .from('month_balances')
      .select('month, start_balance, end_balance')
      .eq('household_id', householdId)
      .in('month', months),
  ])
  const failure = env.error ?? bal.error
  if (failure) return { envelopes: [], balances: {}, incomes: {}, error: failure.message }
  // Revenus: facultatifs tant que la migration 0008 n'est pas passée.
  const inc = await supabase.from('incomes').select('month, amount').eq('household_id', householdId).in('month', months)
  const incomes: Record<string, number> = {}
  for (const i of inc.data ?? []) incomes[i.month] = (incomes[i.month] ?? 0) + Number(i.amount)
  const envelopes = (env.data ?? []).map((e) => ({
    ...e,
    budget: Number(e.budget),
    expenses: ((e.expenses ?? []) as StatExpense[]).map((x) => ({ ...x, amount: Number(x.amount) })),
  })) as StatEnvelope[]
  const balances: Record<string, Balance> = {}
  for (const b of bal.data ?? []) {
    balances[b.month] = {
      start: b.start_balance == null ? null : Number(b.start_balance),
      end: b.end_balance == null ? null : Number(b.end_balance),
    }
  }
  return { envelopes, balances, incomes, error: null }
}

export const spentOf = (e: StatEnvelope) =>
  e.expenses.reduce((sum, x) => (countsAsSpent(x.status) ? sum + x.amount : sum), 0)

export interface MonthTotal {
  month: string
  budget: number
  spent: number
  over: number
}

export function monthTotals(months: string[], envs: StatEnvelope[]): MonthTotal[] {
  return months.map((month) => {
    const mine = envs.filter((e) => e.month === month)
    return {
      month,
      budget: mine.reduce((s, e) => s + e.budget, 0),
      spent: mine.reduce((s, e) => s + spentOf(e), 0),
      over: mine.reduce((s, e) => s + Math.max(0, spentOf(e) - e.budget), 0),
    }
  })
}

export interface MatrixRow {
  name: string
  cells: Record<string, { budget: number; spent: number } | undefined>
  averageSpent: number
  overMonths: number
}

// Les enveloppes sont rapprochées d'un mois à l'autre par leur nom (la reconduction conserve le nom).
export function envelopeMatrix(months: string[], envs: StatEnvelope[]): MatrixRow[] {
  const rows = new Map<string, MatrixRow>()
  for (const e of envs) {
    const key = e.name.trim().toLocaleLowerCase()
    const row = rows.get(key) ?? { name: e.name, cells: {}, averageSpent: 0, overMonths: 0 }
    row.name = e.name // le nom le plus récent
    const prev = row.cells[e.month]
    row.cells[e.month] = { budget: (prev?.budget ?? 0) + e.budget, spent: (prev?.spent ?? 0) + spentOf(e) }
    rows.set(key, row)
  }
  for (const row of rows.values()) {
    const present = months.map((m) => row.cells[m]).filter((c): c is { budget: number; spent: number } => !!c)
    row.averageSpent = present.length ? present.reduce((s, c) => s + c.spent, 0) / present.length : 0
    row.overMonths = present.filter((c) => c.spent > c.budget).length
  }
  return [...rows.values()]
}

// ---- Récapitulatif hebdomadaire (semaines du lundi au dimanche, tronquées aux bornes du mois) ----

const DAY = 86_400_000
const toMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export interface Week {
  start: string
  end: string
}

export function weeksOfMonth(month: string): Week[] {
  const first = toMs(`${month}-01`)
  const [y, m] = month.split('-').map(Number)
  const last = Date.UTC(y, m, 0) // jour 0 du mois suivant = dernier jour de ce mois
  let weekStart = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY
  const weeks: Week[] = []
  while (weekStart <= last) {
    weeks.push({ start: toIso(Math.max(weekStart, first)), end: toIso(Math.min(weekStart + 6 * DAY, last)) })
    weekStart += 7 * DAY
  }
  return weeks
}

export interface WeeklyMatrix {
  weeks: Week[]
  rows: { name: string; perWeek: number[]; other: number }[]
  totals: number[]
  otherTotal: number
}

export function weeklyMatrix(month: string, envs: StatEnvelope[]): WeeklyMatrix {
  const weeks = weeksOfMonth(month)
  const rows = envs
    .filter((e) => e.month === month)
    .map((e) => {
      const perWeek = weeks.map(() => 0)
      let other = 0 // dépenses datées hors du mois
      for (const x of e.expenses) {
        if (!countsAsSpent(x.status)) continue
        const i = weeks.findIndex((w) => x.spent_on >= w.start && x.spent_on <= w.end)
        if (i >= 0) perWeek[i] += x.amount
        else other += x.amount
      }
      return { name: e.name, perWeek, other }
    })
  return {
    weeks,
    rows,
    totals: weeks.map((_, i) => rows.reduce((s, r) => s + r.perWeek[i], 0)),
    otherTotal: rows.reduce((s, r) => s + r.other, 0),
  }
}

// ---- Exports ----

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

/** CSV pour Excel en français: séparateur « ; », virgule décimale, BOM UTF-8. */
export function buildCsv(envs: StatEnvelope[], statusLabel: Record<ExpenseStatus, string>, headers: string[]): string {
  const lines = [headers.map(csvCell).join(';')]
  for (const e of envs) {
    for (const x of [...e.expenses].sort((a, b) => a.spent_on.localeCompare(b.spent_on))) {
      lines.push(
        [
          csvCell(e.month),
          csvCell(e.name),
          csvCell(x.spent_on),
          csvCell(x.note ?? ''),
          String(x.amount).replace('.', ','),
          csvCell(statusLabel[x.status]),
        ].join(';'),
      )
    }
  }
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Sauvegarde complète du foyer (toutes les tables), à conserver en cas de besoin de restauration. */
export async function buildBackup(householdId: string) {
  const eq = (table: string) => supabase.from(table).select('*').eq('household_id', householdId)
  const [envelopes, expenses, balances, savings, milestones, entries] = await Promise.all([
    eq('envelopes'),
    eq('expenses'),
    eq('month_balances'),
    eq('savings_envelopes'),
    eq('savings_milestones'),
    eq('savings_entries'),
  ])
  const [incomes, recurring] = await Promise.all([eq('incomes'), eq('recurring_expenses')])
  const failure = [envelopes, expenses, balances, savings, milestones, entries].find((r) => r.error)
  if (failure?.error) return { json: null, error: failure.error.message }
  return {
    json: JSON.stringify(
      {
        app: 'budget-bloom',
        exported_at: new Date().toISOString(),
        envelopes: envelopes.data,
        expenses: expenses.data,
        month_balances: balances.data,
        savings_envelopes: savings.data,
        savings_milestones: milestones.data,
        savings_entries: entries.data,
        incomes: incomes.error ? [] : incomes.data,
        recurring_expenses: recurring.error ? [] : recurring.data,
      },
      null,
      2,
    ),
    error: null,
  }
}
