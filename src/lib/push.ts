// Abonnement de cet appareil aux notifications.
// - Navigateur / appli installée depuis le navigateur: notifications web (clé VAPID publique).
// - APK Android (Capacitor): notifications Firebase, via le module natif.
// L'abonnement est enregistré dans Supabase (push_subscriptions) pour que le serveur sache où envoyer.

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'

// Clé publique des notifications web (publique par nature: elle identifie l'expéditeur).
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? 'BMkts6AMTzBtu7Q9-sWiZxe4LQHe2HSRFewnZJ5ztocmj3Evp8-piwcANhD_S1He6YWCATCsyrDjvq_JpAVeCZU'
const NATIVE_TOKEN = 'bloomPushToken'

export type PushAvailability = 'native' | 'web' | 'ios-install' | 'unsupported'

export const isNative = () => Capacitor.isNativePlatform()

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function pushAvailability(): PushAvailability {
  if (isNative()) return 'native'
  const web = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  // Sur iPhone, les notifications ne sont possibles qu'une fois l'appli ajoutée à l'écran d'accueil.
  if (isIos() && !isStandalone()) return 'ios-install'
  return web ? 'web' : 'unsupported'
}

function toKey(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function webSubscription() {
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

async function saveWeb(sub: PushSubscription) {
  const json = sub.toJSON()
  return supabase.from('push_subscriptions').upsert(
    { kind: 'web', endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  )
}

function storedToken() {
  try {
    return localStorage.getItem(NATIVE_TOKEN)
  } catch {
    return null
  }
}

/** Notifications actives sur cet appareil ? */
export async function isPushOn(): Promise<boolean> {
  const mode = pushAvailability()
  if (mode === 'native') return !!storedToken() && (await PushNotifications.checkPermissions()).receive === 'granted'
  if (mode !== 'web') return false
  return Notification.permission === 'granted' && !!(await webSubscription())
}

/** Active les notifications sur cet appareil. Renvoie null, « denied » ou un message d'erreur. */
export async function enablePush(): Promise<string | null> {
  const mode = pushAvailability()
  if (mode === 'native') {
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return 'denied'
    const token = await new Promise<string>((resolve, reject) => {
      void PushNotifications.addListener('registration', (t) => resolve(t.value))
      void PushNotifications.addListener('registrationError', (e) => reject(new Error(e.error)))
      void PushNotifications.register()
    })
    const { error } = await supabase.from('push_subscriptions').upsert({ kind: 'fcm', endpoint: token, user_agent: 'android-app' }, { onConflict: 'endpoint' })
    if (error) return error.message
    try {
      localStorage.setItem(NATIVE_TOKEN, token)
    } catch {
      /* stockage indisponible */
    }
    return null
  }
  if (mode !== 'web') return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }))
  const { error } = await saveWeb(sub)
  return error ? error.message : null
}

/** Coupe les notifications sur cet appareil (les autres appareils ne changent pas). */
export async function disablePush() {
  if (isNative()) {
    const token = storedToken()
    if (token) await supabase.from('push_subscriptions').delete().eq('endpoint', token)
    try {
      localStorage.removeItem(NATIVE_TOKEN)
    } catch {
      /* stockage indisponible */
    }
    await PushNotifications.unregister().catch(() => {})
    return
  }
  const sub = await webSubscription().catch(() => null)
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe().catch(() => false)
}

/** Au démarrage: réenregistre l'abonnement de l'appareil s'il existe (base réinitialisée, autre session…). */
export async function syncPush() {
  if (pushAvailability() !== 'web' || Notification.permission !== 'granted') return
  const sub = await webSubscription().catch(() => null)
  if (sub) await saveWeb(sub)
}

/** APK: toucher une notification ouvre la bonne page de l'app. */
export function listenNativePush() {
  if (!isNative()) return
  void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = (action.notification.data as { url?: string } | undefined)?.url
    const hash = url?.includes('#') ? url.slice(url.indexOf('#')) : ''
    if (hash) window.location.hash = hash
  })
}
