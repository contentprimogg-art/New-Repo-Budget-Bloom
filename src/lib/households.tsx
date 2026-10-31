import { createContext, useContext } from 'react'
import { supabase } from './supabase'

// Plusieurs foyers par compte (ex. le foyer du couple et un budget de colocation): la liste des
// foyers dont on est membre et celui qui est affiché, mémorisé sur l'appareil.

export interface HouseholdRef {
  id: string
  name: string
}

const ACTIVE_KEY = 'bloomHousehold'

export function storedActive() {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function storeActive(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* stockage indisponible */
  }
}

export async function loadHouseholds(userId: string): Promise<{ list: HouseholdRef[]; error: string | null }> {
  // Filtré sur soi: les lignes des autres membres de nos foyers sont aussi visibles.
  const { data, error } = await supabase.from('household_members').select('household_id, households(name)').eq('user_id', userId)
  if (error) return { list: [], error: error.message }
  return { list: toRefs(data).sort((a, b) => a.name.localeCompare(b.name)), error: null }
}

function toRefs(rows: { household_id: string; households: unknown }[] | null): HouseholdRef[] {
  return (rows ?? []).map((r) => {
    const h = (Array.isArray(r.households) ? r.households[0] : r.households) as { name?: string } | null
    return { id: r.household_id, name: h?.name ?? '?' }
  })
}

export async function createHousehold(name: string) {
  const { data, error } = await supabase.rpc('create_household', { h_name: name })
  return { id: (data as string | null) ?? null, error: error?.message ?? null }
}

export async function joinHousehold(code: string) {
  const { data, error } = await supabase.rpc('join_household', { code })
  return { id: (data as string | null) ?? null, error: error?.message ?? null }
}

interface HouseholdsValue {
  list: HouseholdRef[]
  activeId: string
  /** Affiche un autre foyer (après création ou adhésion, la liste est rechargée). */
  switchTo: (id: string) => Promise<void>
  /** Recharge les noms (après un renommage). */
  refresh: () => Promise<void>
}

export const HouseholdsContext = createContext<HouseholdsValue | null>(null)

export const useHouseholds = () => useContext(HouseholdsContext)
