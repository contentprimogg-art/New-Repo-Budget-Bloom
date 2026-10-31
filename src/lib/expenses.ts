import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { uuid } from './uuid'

// Mode hors-ligne: les ajouts, modifications et suppressions de dépenses et de revenus faits sans
// réseau sont gardés dans l'appareil (« boîte d'envoi ») puis envoyés dans l'ordre au retour du
// réseau. Chaque élément a son identifiant dès la saisie: un renvoi ne crée jamais de doublon.
// En attendant, les écrans fusionnent ces opérations avec les données reçues (mergePending).

type Table = 'expenses' | 'incomes'
type Row = Record<string, unknown> & { id: string }

export type Op =
  | { kind: 'insert'; table: Table; row: Row }
  | { kind: 'update'; table: Table; id: string; values: Record<string, unknown> }
  | { kind: 'delete'; table: Table; id: string }

const KEY = 'bloomOutbox'
const EVENT = 'bloom-outbox'

function read(): Op[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    // Ancien format (avant les modifications hors-ligne): une simple liste de dépenses à insérer.
    return Array.isArray(list) ? list.map((o) => ('kind' in o ? o : { kind: 'insert', table: 'expenses', row: o })) : []
  } catch {
    return []
  }
}

function write(list: Op[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVENT))
}

const targetId = (op: Op) => (op.kind === 'insert' ? op.row.id : op.id)

// Mise en file, en fusionnant avec un ajout encore en attente sur le même élément.
function enqueue(op: Op) {
  const list = read()
  const i = list.findIndex((o) => o.kind === 'insert' && o.table === op.table && o.row.id === targetId(op))
  if (i >= 0 && op.kind !== 'insert') {
    const insert = list[i] as Extract<Op, { kind: 'insert' }>
    if (op.kind === 'delete') list.splice(i, 1)
    else list[i] = { ...insert, row: { ...insert.row, ...op.values } }
    return write(list)
  }
  write([...list, op])
}

const isNetworkError = (message?: string | null) =>
  !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(message ?? '')

async function run(op: Op): Promise<string | null> {
  const table = supabase.from(op.table)
  const { error } =
    op.kind === 'insert'
      ? await table.upsert(op.row, { onConflict: 'id', ignoreDuplicates: true })
      : op.kind === 'update'
        ? await table.update(op.values).eq('id', op.id)
        : await table.delete().eq('id', op.id)
  return error?.message ?? null
}

/** Exécute l'opération, ou la met en attente sans réseau. */
export async function mutate(op: Op): Promise<{ queued: boolean; error: string | null }> {
  if (!navigator.onLine) {
    enqueue(op)
    return { queued: true, error: null }
  }
  const error = await run(op)
  if (!error) return { queued: false, error: null }
  if (isNetworkError(error)) {
    enqueue(op)
    return { queued: true, error: null }
  }
  return { queued: false, error }
}

export interface NewExpense {
  household_id: string
  envelope_id: string
  amount: number
  note: string | null
  spent_on: string
}

export const addExpense = (expense: NewExpense) => mutate({ kind: 'insert', table: 'expenses', row: { ...expense, id: uuid() } })

let flushing = false

/** Envoie les opérations en attente, dans l'ordre. Renvoie le nombre d'opérations envoyées. */
export async function flushOutbox(): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  const pending = read()
  if (pending.length === 0) return 0
  flushing = true
  let done = 0
  try {
    for (const op of pending) {
      const error = await run(op)
      if (error && isNetworkError(error)) break // réseau de nouveau perdu: on garde la suite
      if (error) console.warn('Opération hors-ligne refusée par le serveur:', error, op) // ex. enveloppe supprimée entre-temps
      done++
    }
    write(read().slice(done))
  } finally {
    flushing = false
  }
  return done
}

/** Fusionne les opérations en attente d'une table avec des lignes reçues du serveur (ou du cache). */
export function mergePending<T extends { id: string }>(table: Table, rows: T[], belongs: (row: T) => boolean): T[] {
  let out = [...rows]
  for (const op of read()) {
    if (op.table !== table) continue
    if (op.kind === 'insert') {
      const row = { ...(op.row as unknown as T), pending: true }
      if (belongs(row) && !out.some((r) => r.id === row.id)) out.push(row)
    } else if (op.kind === 'update') {
      out = out.map((r) => (r.id === op.id ? { ...r, ...(op.values as Partial<T>), pending: true } : r))
    } else {
      out = out.filter((r) => r.id !== op.id)
    }
  }
  return out
}

export const outboxCount = () => read().length
export const clearOutbox = () => write([])

/** Nombre d'opérations en attente, mis à jour en direct. */
export function useOutboxCount() {
  const [count, setCount] = useState(outboxCount)
  useEffect(() => {
    const update = () => setCount(outboxCount())
    window.addEventListener(EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return count
}
