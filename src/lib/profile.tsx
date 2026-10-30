import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import type { Profile } from './types'

interface ProfileValue {
  userId: string
  email: string
  profile: Profile
  avatarUrl: string | null
}

const ProfileContext = createContext<ProfileValue | null>(null)

interface Meta {
  first_name?: string
  last_name?: string
  avatar_path?: string
  avatar_version?: number
}

// Prénom, nom et photo viennent des métadonnées du compte; la photo est dans un bucket privé,
// on obtient donc une adresse temporaire signée, renouvelée avant son expiration.
export function ProfileProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  const meta = (session.user.user_metadata ?? {}) as Meta
  const firstName = meta.first_name?.trim() || null
  const lastName = meta.last_name?.trim() || null
  const avatarPath = meta.avatar_path || null
  const avatarVersion = meta.avatar_version
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function sign() {
      if (!avatarPath) return setAvatarUrl(null)
      const { data } = await supabase.storage.from('avatars').createSignedUrl(avatarPath, 3600)
      if (!cancelled) setAvatarUrl(data?.signedUrl ?? null)
    }
    void sign()
    const timer = setInterval(() => void sign(), 50 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [avatarPath, avatarVersion])

  useEffect(() => {
    // L'appareil se souvient du prénom pour saluer la personne sur l'écran de connexion.
    if (!firstName) return
    try {
      localStorage.setItem('bloomName', firstName)
    } catch {
      /* stockage indisponible */
    }
  }, [firstName])

  const value = useMemo<ProfileValue>(
    () => ({
      userId: session.user.id,
      email: session.user.email ?? '',
      profile: { firstName, lastName },
      avatarUrl,
    }),
    [session.user.id, session.user.email, firstName, lastName, avatarUrl],
  )
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile doit être utilisé dans ProfileProvider')
  return value
}
