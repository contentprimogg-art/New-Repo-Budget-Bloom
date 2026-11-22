import { disablePush } from './push'
import { clearOutbox, flushOutbox } from './expenses'
import { clearPageCache } from './pageCache'
import { supabase } from './supabase'

export const REST_CACHE = 'supabase-rest'

/** Déconnexion: on efface aussi les données gardées pour le mode hors-ligne (appareil partagé). */
export async function signOut() {
  // Dernière tentative d'envoi des saisies hors-ligne avant de vider l'appareil.
  await flushOutbox().catch(() => 0)
  clearOutbox()
  clearPageCache()
  try {
    await caches.delete(REST_CACHE)
  } catch {
    /* Cache Storage indisponible */
  }
  // Cet appareil ne doit plus recevoir les notifications du compte.
  await disablePush().catch(() => {})
  await supabase.auth.signOut()
}
