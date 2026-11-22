import { BACKUP_TABLES } from './backupTables'
import type { Backup } from './restore'

// Sauvegarde complète au format CSV: un seul fichier, une ligne par élément, lisible dans un tableur.
// Chaque élément garde son identifiant: réimporter le fichier ne crée pas de doublon.
// L'import vérifie tout le fichier AVANT d'écrire quoi que ce soit: au moindre doute, il refuse.

type Row = Record<string, unknown>
export type CsvParse = { backup: Backup } | { errorKey: string; params?: Record<string, string | number> }

const MARKER = 'budget_bloom_table'
const META = '_sauvegarde'
const COLUMNS = [...new Set(BACKUP_TABLES.flatMap((t) => t.columns))]
const HEADER = [MARKER, ...COLUMNS, 'exported_at', 'counts']

const UUID = new Set(['id', 'parent_id', 'envelope_id', 'group_id', 'lineage_id', 'source_id', 'recurring_id', 'savings_id', 'source_expense_id', 'transfer_id'])
const MONEY = new Set(['budget', 'amount', 'start_balance', 'end_balance', 'target', 'original_amount'])
const INTEGER = new Set(['sort', 'every_months', 'day'])
const BOOLEAN = new Set(['recurring', 'from_budget'])
const MONTH = new Set(['month', 'next_month'])
const DATE = new Set(['spent_on', 'settled_on', 'received_on', 'entry_date'])

// Champs obligatoires de chaque type d'élément.
const REQUIRED: Record<string, string[]> = {
  envelope_groups: ['id', 'name'],
  envelopes: ['id', 'month', 'name', 'kind', 'budget'],
  recurring_expenses: ['id', 'lineage_id', 'amount', 'every_months', 'day', 'next_month'],
  expenses: ['id', 'envelope_id', 'amount', 'spent_on', 'status'],
  incomes: ['id', 'month', 'label', 'amount', 'received_on'],
  month_balances: ['month'],
  savings_envelopes: ['id', 'name'],
  savings_milestones: ['id', 'savings_id', 'amount'],
  savings_entries: ['id', 'savings_id', 'amount', 'entry_date'],
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const isMonth = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
const isDate = (v: string) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)
const isTimestamp = (v: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)$/.test(v)

// Un tableur exécuterait un texte commençant par ces signes: il est protégé par une apostrophe.
const FORMULA = /^'*[=+\-@\t\r]/
const protectText = (v: string) => (FORMULA.test(v) ? `'${v}` : v)
const unprotectText = (v: string) => (/^'+[=+\-@\t\r]/.test(v) ? v.slice(1) : v)

function cell(column: string, value: unknown) {
  if (value === null || value === undefined) return ''
  if (MONEY.has(column)) return String(value).replace('.', ',')
  if (INTEGER.has(column) || BOOLEAN.has(column)) return String(value)
  return `"${protectText(String(value)).replace(/"/g, '""')}"`
}

/** Fichier CSV complet à partir du contenu d'une sauvegarde. */
export function backupToCsv(data: Record<string, unknown>) {
  const counts: Record<string, number> = {}
  const lines = [HEADER.join(';')]
  for (const table of BACKUP_TABLES) {
    const rows = (Array.isArray(data[table.name]) ? data[table.name] : []) as Row[]
    counts[table.name] = rows.length
    for (const row of rows) {
      lines.push([table.name, ...COLUMNS.map((c) => (table.columns.includes(c) ? cell(c, row[c]) : '')), '', ''].join(';'))
    }
  }
  const quotedCounts = `"${JSON.stringify(counts).replace(/"/g, '""')}"`
  lines.push([META, ...COLUMNS.map(() => ''), `"${String(data.exported_at ?? '')}"`, quotedCounts].join(';'))
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Découpe un CSV (guillemets et retours à la ligne dans les cellules). Renvoie null s'il est tronqué. */
function readCsv(text: string, separator: string) {
  const records: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let value = ''
  let quoted = false
  let line = 1
  let start = 1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\n') line++
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"'
        i++
      } else if (c === '"') quoted = false
      else value += c
    } else if (c === '"') quoted = true
    else if (c === separator) {
      cells.push(value)
      value = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') {
        i++
        line++
      }
      cells.push(value)
      value = ''
      if (cells.some((x) => x !== '')) records.push({ line: start, cells })
      cells = []
      start = line
    } else value += c
  }
  if (quoted) return null
  if (value || cells.length) {
    cells.push(value)
    if (cells.some((x) => x !== '')) records.push({ line: start, cells })
  }
  return records
}

// Convertit une cellule; undefined = valeur invalide.
function convert(table: string, column: string, raw: string): unknown {
  if (raw === '') return column === 'from_budget' ? false : null
  if (UUID.has(column)) return isUuid(raw) ? raw : undefined
  if (MONEY.has(column)) return /^-?\d+([.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(',', '.')) : undefined
  if (INTEGER.has(column)) {
    if (!/^-?\d+$/.test(raw)) return undefined
    const n = Number(raw)
    if (column === 'every_months' && ![1, 2, 3, 6, 12].includes(n)) return undefined
    if (column === 'day' && (n < 1 || n > 31)) return undefined
    return n
  }
  if (BOOLEAN.has(column)) return raw === 'true' ? true : raw === 'false' ? false : undefined
  if (MONTH.has(column)) return isMonth(raw) ? raw : undefined
  if (DATE.has(column)) return isDate(raw) ? raw : undefined
  if (column === 'created_at') return isTimestamp(raw) ? raw : undefined
  if (column === 'status') return ['active', 'refunded', 'kept'].includes(raw) ? raw : undefined
  if (column === 'kind' && table === 'envelopes') return ['spending', 'savings'].includes(raw) ? raw : undefined
  return unprotectText(raw)
}

/** Lit et vérifie un CSV de sauvegarde. Aucune donnée n'est écrite ici. */
export function parseCsvBackup(input: string): CsvParse {
  const text = input.replace(/^﻿/, '')
  const firstLine = text.slice(0, text.search(/\r?\n|$/))
  const separator = firstLine.includes(';') ? ';' : ','
  const records = readCsv(text, separator)
  if (!records || records.length === 0) return { errorKey: 'errCsvNotBackup' }
  const header = records[0].cells
  if (header[0] !== MARKER) return { errorKey: 'errCsvNotBackup' }
  const position = new Map(header.map((h, i) => [h, i]))
  if (HEADER.some((h) => !position.has(h))) return { errorKey: 'errCsvModified' }

  const rows: Record<string, Row[]> = Object.fromEntries(BACKUP_TABLES.map((t) => [t.name, []]))
  const seen = new Set<string>()
  let exportedAt: string | null = null
  let counts: Record<string, number> | null = null

  for (const { line, cells } of records.slice(1)) {
    const name = cells[0]
    if (name === META) {
      exportedAt = cells[position.get('exported_at')!] || null
      try {
        counts = JSON.parse(cells[position.get('counts')!]) as Record<string, number>
      } catch {
        return { errorKey: 'errCsvModified' }
      }
      continue
    }
    const table = BACKUP_TABLES.find((t) => t.name === name)
    if (!table) return { errorKey: 'errCsvLine', params: { line, column: MARKER } }
    const row: Row = {}
    for (const column of table.columns) {
      const value = convert(table.name, column, cells[position.get(column)!] ?? '')
      if (value === undefined || (value === null && REQUIRED[table.name].includes(column))) {
        return { errorKey: 'errCsvLine', params: { line, column } }
      }
      row[column] = value
    }
    const key = `${table.name}:${table.name === 'month_balances' ? row.month : row.id}`
    if (seen.has(key)) return { errorKey: 'errCsvLine', params: { line, column: table.name === 'month_balances' ? 'month' : 'id' } }
    seen.add(key)
    rows[table.name].push(row)
  }

  // Le fichier annonce son contenu: une ligne en moins signifie qu'il a été coupé ou modifié.
  if (!counts || BACKUP_TABLES.some((t) => (counts as Record<string, number>)[t.name] !== rows[t.name].length)) {
    return { errorKey: 'errCsvModified' }
  }
  return { backup: { exportedAt, rows } }
}
