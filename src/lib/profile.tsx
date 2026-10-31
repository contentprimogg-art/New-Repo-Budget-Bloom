import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { applyPalette, paletteFrom, storePalette, type Palette } from './theme'
import type { Profile } from './types'

interface ProfileValue {
  userId: string
  email: string
  profile: Profile
  avatarUrl: string | null
  palette: Palette | null
}

const ProfileContext = createContext<ProfileValue | null>(null)

interface Meta {
  first_name?: string
  last_name?: string
  avatar_path?: string
  avatar_version?: number
  palette?: unknown
}

// Ce que l'appareil garde pour l'écran de connexion (comme une appli bancaire qui vous reconnaît).
export const SAVED_NAME = 'bloomName'
export const SAVED_PHOTO = 'bloomAvatar'

function remember(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* stockage plein ou indisponible: l'écran de connexion affichera simplement le dégradé */
  }
}

async function toDataUrl(url: string): Promise<string | null> {
  const blob = await fetch(url).then((r) => (r.ok ? r.blob() : null))
  if (!blob || blob.size > 400_000) return null
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

// Prénom, nom, photo et palette viennent des métadonnées du compte. La photo est dans un bucket
// privé: on obtient une adresse temporaire signée, renouvelée avant son expiration.
export function ProfileProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  const meta = (session.user.user_metadata ?? {}) as Meta
  const firstName = meta.first_name?.trim() || null
  const lastName = meta.last_name?.trim() || null
  const avatarPath = meta.avatar_path || null
  const avatarVersion = meta.avatar_version
  const palette = paletteFrom(meta.palette)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function sign() {
      if (!avatarPath) {
        setAvatarUrl(null)
        remember(SAVED_PHOTO, null)
        return
      }
      const { data } = await supabase.storage.from('avatars').createSignedUrl(avatarPath, 3600)
      if (cancelled || !data?.signedUrl) return
      setAvatarUrl(data.signedUrl)
      remember(SAVED_PHOTO, await toDataUrl(data.signedUrl).catch(() => null))
    }
    void sign()
    const timer = setInterval(() => void sign(), 50 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [avatarPath, avatarVersion])

  useEffect(() => {
    if (firstName) remember(SAVED_NAME, firstName)
  }, [firstName])

  // Copie du profil dans la table « profiles » pour que les autres membres du foyer voient le nom et la
  // photo (sans la migration 0008, la table n'existe pas encore: l'erreur est simplement ignorée).
  useEffect(() => {
    void supabase
      .from('profiles')
      .upsert({ id: session.user.id, first_name: firstName, last_name: lastName, avatar_path: avatarPath, updated_at: new Date().toISOString() })
      .then(({ error }) => error && console.warn('profiles:', error.message))
  }, [session.user.id, firstName, lastName, avatarPath])

  // La palette enregistrée dans le compte suit la personne d'un appareil à l'autre.
  const paletteKey = palette ? `${palette.id}:${palette.accent}` : null
  useEffect(() => {
    if (!palette) return
    applyPalette(palette)
    storePalette(palette)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteKey])

  const value = useMemo<ProfileValue>(
    () => ({
      userId: session.user.id,
      email: session.user.email ?? '',
      profile: { firstName, lastName },
      avatarUrl,
      palette,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.user.id, session.user.email, firstName, lastName, avatarUrl, paletteKey],
  )
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile doit être utilisé dans ProfileProvider')
  return value
}

/** Variante tolérante (aperçu de développement, écrans hors connexion). */
export const useOptionalProfile = () => useContext(ProfileContext)
