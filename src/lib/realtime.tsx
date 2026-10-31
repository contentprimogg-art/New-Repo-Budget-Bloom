import { createContext, useContext, useEffect, useState } from 'react'
import { flushOutbox } from './expenses'
import { supabase } from './supabase'

const TABLES = [
  'envelopes',
  'expenses',
  'month_balances',
  'envelope_groups',
  'savings_envelopes',
  'savings_milestones',
  'savings_entries',
] as const

const VersionContext = createContext(0)

// Mise à jour en direct: quand un autre appareil du foyer modifie quelque chose, le « numéro de
// version » augmente et les écrans qui en dépendent rechargent leurs données.
export function DataProvider({ householdId, children }: { householdId: string; children: React.ReactNode }) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const bump = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setVersion((v) => v + 1), 400)
    }

    const channel = supabase.channel(`household-${householdId}`)
    for (const table of TABLES) {
      const filter = `household_id=eq.${householdId}`
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, bump)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, bump)
      // Les suppressions ne sont pas filtrables côté Supabase: elles ne contiennent que l'identifiant.
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, bump)
    }
    channel.subscribe()

    // Hors-ligne: dès que le réseau revient, on envoie les dépenses en attente et on recharge.
    const online = () => void flushOutbox().finally(bump)
    window.addEventListener('online', online)
    void flushOutbox().then((n) => n > 0 && bump())

    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', online)
      void supabase.removeChannel(channel)
    }
  }, [householdId])

  return <VersionContext.Provider value={version}>{children}</VersionContext.Provider>
}

export const useDataVersion = () => useContext(VersionContext)
