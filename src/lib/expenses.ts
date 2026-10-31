import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { uuid } from './uuid'

export interface NewExpense {
  household_id: string
  envelope_id: string
  amount: number
  note: string | null
  spent_on: string
}

// Mode hors-ligne: une dépense saisie sans réseau est gardée dans l'appareil (« boîte d'envoi »)
// puis envoyée au retour du réseau. Chaque dépense a son identifiant dès la saisie, donc un
// renvoi ne crée jamais de doublon.
interface Pending extends NewExpense {
  id: string
}

const KEY = 'bloomOutbox'
const EVENT = 'bloom-outbox'

function read(): Pending[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(list: Pending[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVENT))
}

const isNetworkError = (message?: string) =>
  !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(message ?? '')

/** Ajoute une dépense; hors-ligne, elle est mise en attente. */
export async function addExpense(expense: NewExpense): Promise<{ queued: boolean; error: string | null }> {
  const row: Pending = { ...expense, id: uuid() }
  if (!navigator.onLine) {
    write([...read(), row])
    return { queued: true, error: null }
  }
  const { error } = await supabase.from('expenses').insert(row)
  if (!error) return { queued: false, error: null }
  if (isNetworkError(error.message)) {
    write([...read(), row])
    return { queued: true, error: null }
  }
  return { queued: false, error: error.message }
}

let flushing = false

/** Envoie les dépenses en attente. Renvoie le nombre de dépenses envoyées. */
export async function flushOutbox(): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  const pending = read()
  if (pending.length === 0) return 0
  flushing = true
  let sent = 0
  try {
    const kept: Pending[] = []
    for (const row of pending) {
      const { error } = await supabase.from('expenses').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
      if (!error) sent++
      else if (isNetworkError(error.message)) kept.push(row)
      else console.warn('Dépense hors-ligne refusée par le serveur:', error.message, row) // ex. enveloppe supprimée entre-temps
    }
    const sentIds = new Set(pending.filter((p) => !kept.includes(p)).map((p) => p.id))
    write(read().filter((p) => !sentIds.has(p.id)))
  } finally {
    flushing = false
  }
  return sent
}

export const outboxCount = () => read().length
export const clearOutbox = () => write([])

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
