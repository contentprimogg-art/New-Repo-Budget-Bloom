import { disablePush } from './push'
import { clearOutbox } from './expenses'
import { supabase } from './supabase'

export const REST_CACHE = 'supabase-rest'

/** Déconnexion: on efface aussi les données gardées pour le mode hors-ligne (appareil partagé). */
export async function signOut() {
  clearOutbox()
  try {
    await caches.delete(REST_CACHE)
  } catch {
    /* Cache Storage indisponible */
  }
  // Cet appareil ne doit plus recevoir les notifications du compte.
  await disablePush().catch(() => {})
  await supabase.auth.signOut()
}
