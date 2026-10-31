import { createContext, useContext, useEffect, useState } from 'react'
import { flushOutbox } from './expenses'
import { supabase } from './supabase'

// Tables qui ont une colonne household_id (filtrables par foyer).
const TABLES = [
  'envelopes',
  'expenses',
  'month_balances',
  'envelope_groups',
  'savings_envelopes',
  'savings_milestones',
  'savings_entries',
  'incomes',
  'recurring_expenses',
] as const

const VersionContext = createContext(0)

// Mise à jour en direct: quand un autre appareil du foyer modifie quelque chose (ou quand une
// opération hors-ligne est mise en attente / envoyée), le « numéro de version » augmente et les
// écrans qui en dépendent rechargent leurs données.
export function DataProvider({ householdId, children }: { householdId: string; children: React.ReactNode }) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const bump = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setVersion((v) => v + 1), 300)
    }

    const channel = supabase.channel(`household-${householdId}`)
    const filter = `household_id=eq.${householdId}`
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, bump)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, bump)
      // Les suppressions ne sont pas filtrables côté Supabase: elles ne contiennent que l'identifiant.
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, bump)
    }
    // Profils des membres (nom, photo) et réglages du foyer (devise).
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, bump)
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, bump)
    channel.subscribe()

    // Hors-ligne: dès que le réseau revient, on envoie les opérations en attente et on recharge.
    const online = () => void flushOutbox().finally(bump)
    window.addEventListener('online', online)
    window.addEventListener('bloom-outbox', bump)
    void flushOutbox().then((n) => n > 0 && bump())

    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', online)
      window.removeEventListener('bloom-outbox', bump)
      void supabase.removeChannel(channel)
    }
  }, [householdId])

  return <VersionContext.Provider value={version}>{children}</VersionContext.Provider>
}

export const useDataVersion = () => useContext(VersionContext)
