import { supabase } from './supabase'

// Restauration d'une sauvegarde JSON (fichier produit par « Sauvegarde complète »).
// Les lignes sont réécrites dans le foyer actuel et fusionnées par identifiant: une ligne qui
// existe déjà est remplacée par sa version sauvegardée, les autres données ne sont pas touchées.

type Row = Record<string, unknown>

// Colonnes reprises pour chaque table, dans l'ordre d'insertion (les références d'abord).
const TABLES: { name: string; columns: string[]; conflict: string }[] = [
  { name: 'envelope_groups', columns: ['id', 'name', 'sort', 'created_at'], conflict: 'id' },
  {
    name: 'envelopes',
    columns: ['id', 'month', 'name', 'kind', 'parent_id', 'budget', 'color', 'icon', 'sort', 'recurring', 'source_id', 'group_id', 'lineage_id', 'created_at'],
    conflict: 'id',
  },
  {
    name: 'recurring_expenses',
    columns: ['id', 'lineage_id', 'note', 'amount', 'every_months', 'day', 'next_month', 'created_at'],
    conflict: 'id',
  },
  {
    name: 'expenses',
    columns: ['id', 'envelope_id', 'amount', 'note', 'spent_on', 'status', 'settled_on', 'recurring_id', 'original_amount', 'original_currency', 'created_at'],
    conflict: 'id',
  },
  {
    name: 'incomes',
    columns: ['id', 'month', 'label', 'amount', 'received_on', 'recurring', 'icon', 'color', 'source_id', 'created_at'],
    conflict: 'id',
  },
  { name: 'month_balances', columns: ['month', 'start_balance', 'end_balance'], conflict: 'household_id,month' },
  { name: 'savings_envelopes', columns: ['id', 'parent_id', 'name', 'target', 'sort', 'icon', 'color', 'created_at'], conflict: 'id' },
  { name: 'savings_milestones', columns: ['id', 'savings_id', 'amount'], conflict: 'id' },
  {
    name: 'savings_entries',
    columns: ['id', 'savings_id', 'amount', 'note', 'entry_date', 'source_expense_id', 'transfer_id', 'created_at'],
    conflict: 'id',
  },
]

export interface Backup {
  exportedAt: string | null
  rows: Record<string, Row[]>
}

export function parseBackup(text: string): Backup | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  if (!json || typeof json !== 'object' || (json as Row).app !== 'budget-bloom') return null
  const source = json as Record<string, unknown>
  const rows: Record<string, Row[]> = {}
  for (const table of TABLES) {
    const list = source[table.name]
    rows[table.name] = Array.isArray(list) ? list.filter((r): r is Row => !!r && typeof r === 'object') : []
  }
  return { exportedAt: typeof source.exported_at === 'string' ? source.exported_at : null, rows }
}

export async function restoreBackup(householdId: string, backup: Backup): Promise<string | null> {
  for (const table of TABLES) {
    let list = backup.rows[table.name]
    if (list.length === 0) continue
    // Ordres nécessaires aux références internes: mois croissants (reconduction), mères avant sous-enveloppes.
    if (table.name === 'envelopes' || table.name === 'incomes') list = [...list].sort((a, b) => String(a.month).localeCompare(String(b.month)))
    if (table.name === 'savings_envelopes') list = [...list].sort((a, b) => Number(!!a.parent_id) - Number(!!b.parent_id))
    const clean = list.map((r) => {
      const out: Row = { household_id: householdId }
      for (const c of table.columns) if (c in r) out[c] = r[c]
      return out
    })
    for (let i = 0; i < clean.length; i += 300) {
      const { error } = await supabase.from(table.name).upsert(clean.slice(i, i + 300), { onConflict: table.conflict })
      if (error) return `${table.name}: ${error.message}`
    }
  }
  return null
}
