import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setCurrency as setFormatCurrency } from './format'
import { useDataVersion } from './realtime'
import { supabase } from './supabase'

export interface Member {
  id: string
  name: string
  avatarUrl: string | null
  isMe: boolean
}

interface HouseholdValue {
  id: string
  currency: string
  members: Member[]
  memberById: Record<string, Member>
  /** Vrai s'il y a plusieurs personnes dans le foyer (sinon inutile d'afficher qui a fait quoi). */
  shared: boolean
  changeCurrency: (code: string) => Promise<string | null>
}

const HouseholdContext = createContext<HouseholdValue | null>(null)

// Foyer: devise et membres (nom et photo de chacun, visibles par les autres membres).
export function HouseholdProvider({ householdId, userId, children }: { householdId: string; userId: string; children: React.ReactNode }) {
  const version = useDataVersion()
  const [currency, setCurrency] = useState('EUR')
  const [members, setMembers] = useState<Member[]>([])

  const load = useCallback(async () => {
    const [house, rows] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
      supabase.from('household_members').select('user_id').eq('household_id', householdId),
    ])
    if (house.data?.currency) setCurrency(house.data.currency as string)
    const ids = (rows.data ?? []).map((r) => r.user_id as string)
    // Les profils n'existent qu'après la migration 0008: sans eux, on garde des pastilles neutres.
    const profiles = ids.length ? await supabase.from('profiles').select('id, first_name, last_name, avatar_path').in('id', ids) : null
    const byId = new Map((profiles?.data ?? []).map((p) => [p.id as string, p]))
    const paths = [...byId.values()].map((p) => p.avatar_path as string | null).filter((p): p is string => !!p)
    const signed = paths.length ? await supabase.storage.from('avatars').createSignedUrls(paths, 3600) : null
    const urlByPath = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]))
    setMembers(
      ids.map((id) => {
        const p = byId.get(id)
        const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
        return {
          id,
          name: name || '?',
          avatarUrl: p?.avatar_path ? (urlByPath.get(p.avatar_path as string) ?? null) : null,
          isMe: id === userId,
        }
      }),
    )
  }, [householdId, userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, version])

  const changeCurrency = useCallback(
    async (code: string) => {
      const { error } = await supabase.from('households').update({ currency: code }).eq('id', householdId)
      if (error) return error.message
      setCurrency(code)
      return null
    },
    [householdId],
  )

  // Les montants sont formatés partout avec la devise du foyer.
  setFormatCurrency(currency)

  const value = useMemo<HouseholdValue>(
    () => ({
      id: householdId,
      currency,
      members,
      memberById: Object.fromEntries(members.map((m) => [m.id, m])),
      shared: members.length > 1,
      changeCurrency,
    }),
    [householdId, currency, members, changeCurrency],
  )

  // Changer de devise remonte les écrans pour que tous les montants se réaffichent.
  return (
    <HouseholdContext.Provider value={value}>
      <Fragment key={currency}>{children}</Fragment>
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold doit être utilisé dans HouseholdProvider')
  return value
}

/** Variante tolérante (aperçu de développement). */
export const useOptionalHousehold = () => useContext(HouseholdContext)
