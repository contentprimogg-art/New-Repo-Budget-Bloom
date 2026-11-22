import { BACKUP_TABLES as TABLES } from './backupTables'
import { supabase } from './supabase'

// Restauration d'une sauvegarde complète (fichier JSON ou CSV).
// Les lignes sont réécrites dans le foyer actuel et fusionnées par identifiant: une ligne qui
// existe déjà est remplacée par sa version sauvegardée, les autres données ne sont pas touchées.

type Row = Record<string, unknown>

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
