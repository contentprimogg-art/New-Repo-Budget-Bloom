// Fonction serveur « notify » (Supabase Edge Function, Deno).
// Appelée par la base de données (nouvelle dépense, et chaque heure pour les bilans et rappels),
// ou par l'app pour une notification de test. Envoie aux appareils abonnés: notifications web
// (navigateur, appli installée depuis le navigateur) et Android (APK, via Firebase).
//
// Secrets de la fonction (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   clés des notifications web
//   FCM_SERVICE_ACCOUNT                   compte de service Firebase (JSON), pour l'APK (facultatif)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import webpush from 'npm:web-push@3.6.7'

const APP_URL = 'https://budgetbloom.ciaoprimo.fr/'
const TZ = 'Europe/Paris'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(APP_URL, VAPID_PUBLIC, VAPID_PRIVATE)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Lang = 'fr' | 'en'
type Pref = 'expenses' | 'envelopes' | 'weekly' | 'reminders'
interface Message {
  title: string
  body: string
  url: string
  tag: string
}

// ——— Textes ———

const TEXT = {
  fr: {
    added: (who: string, amount: string, note: string | null) => `${who} a ajouté ${amount}${note ? ` · ${note}` : ''}`,
    someone: 'Quelqu’un',
    at80: (left: string) => `80 % du budget utilisé : il reste ${left} pour le mois.`,
    over: (over: string) => `Budget dépassé de ${over}. Ça arrive ! Bloom a une idée pour rééquilibrer 🌸`,
    weekTitle: 'Votre semaine avec Bloom',
    week: (spent: string) => `${spent} dépensés ces 7 derniers jours.`,
    weekOver: (names: string) => `À surveiller : ${names}.`,
    weekCalm: 'Toutes les enveloppes tiennent leur budget 🌸',
    quietTitle: 'Un petit rattrapage ?',
    quiet: 'Rien de noté depuis 7 jours… ou alors une semaine très sage 😉',
    monthTitle: 'Nouveau mois 🌱',
    month: (prev: string) => `Ouvrez Bloom pour préparer les enveloppes du mois et voir le bilan de ${prev}.`,
    testTitle: 'Budget Bloom',
    test: 'Les notifications fonctionnent sur cet appareil 🌸',
  },
  en: {
    added: (who: string, amount: string, note: string | null) => `${who} added ${amount}${note ? ` · ${note}` : ''}`,
    someone: 'Someone',
    at80: (left: string) => `80% of the budget used: ${left} left for the month.`,
    over: (over: string) => `Budget exceeded by ${over}. It happens! Bloom has an idea to rebalance 🌸`,
    weekTitle: 'Your week with Bloom',
    week: (spent: string) => `${spent} spent over the last 7 days.`,
    weekOver: (names: string) => `Keep an eye on: ${names}.`,
    weekCalm: 'Every envelope is within budget 🌸',
    quietTitle: 'A little catch-up?',
    quiet: 'Nothing noted for 7 days… or a very frugal week 😉',
    monthTitle: 'New month 🌱',
    month: (prev: string) => `Open Bloom to set up this month's envelopes and see the ${prev} review.`,
    testTitle: 'Budget Bloom',
    test: 'Notifications work on this device 🌸',
  },
}

const money = (n: number, lang: Lang, currency: string) =>
  new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { style: 'currency', currency }).format(n)

// ——— Date et heure de Paris ———

function parisNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return { date, month: date.slice(0, 7), day: Number(parts.day), hour: Number(parts.hour), weekday: parts.weekday as string }
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function prevMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

const monthName = (month: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))

// ——— Anti-doublon ———

/** Vrai la première fois qu'on voit cette clé (l'envoi peut avoir lieu), faux ensuite. */
async function once(key: string) {
  const { error } = await db.from('notification_log').insert({ key })
  return !error
}

// ——— Envoi ———

let fcmCache: { token: string; projectId: string; expires: number } | null = null

const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** Jeton d'accès Firebase à partir du compte de service (JWT signé, valable une heure). */
async function fcmAccess() {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!raw) return null
  if (fcmCache && fcmCache.expires > Date.now() + 60_000) return fcmCache
  const sa = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string }
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )}`
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(signature)}` }),
  })
  if (!res.ok) {
    console.error('fcm token', res.status, await res.text())
    return null
  }
  const json = (await res.json()) as { access_token: string; expires_in: number }
  fcmCache = { token: json.access_token, projectId: sa.project_id, expires: Date.now() + json.expires_in * 1000 }
  return fcmCache
}

interface Sub {
  id: string
  user_id: string
  kind: 'web' | 'fcm'
  endpoint: string
  p256dh: string | null
  auth: string | null
}

/** Envoie à un appareil; renvoie faux si l'abonnement n'existe plus (à supprimer). */
async function deliver(sub: Sub, msg: Message): Promise<boolean> {
  if (sub.kind === 'web') {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return true
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh!, auth: sub.auth! } }, JSON.stringify(msg), {
        TTL: 24 * 3600,
        urgency: 'normal',
      })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) return false
      console.error('web push', status, (e as Error).message)
    }
    return true
  }
  const access = await fcmAccess()
  if (!access) return true
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${access.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: sub.endpoint,
        notification: { title: msg.title, body: msg.body },
        data: { url: msg.url },
        android: { notification: { tag: msg.tag, color: '#E46A9E', icon: 'ic_stat_bloom' } },
      },
    }),
  })
  if (res.ok) return true
  const text = await res.text()
  if (res.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(text)) return false
  console.error('fcm', res.status, text)
  return true
}

/** Envoie à ces personnes (selon leurs préférences), chacune dans sa langue. */
async function sendTo(userIds: string[], pref: Pref | null, build: (lang: Lang) => Message) {
  if (userIds.length === 0) return 0
  const [settings, subs] = await Promise.all([
    db.from('notification_settings').select('*').in('user_id', userIds),
    db.from('push_subscriptions').select('*').in('user_id', userIds),
  ])
  const byUser = new Map((settings.data ?? []).map((s) => [s.user_id as string, s]))
  let sent = 0
  for (const sub of (subs.data ?? []) as Sub[]) {
    const s = byUser.get(sub.user_id)
    if (pref && s && s[pref] === false) continue
    const lang: Lang = s?.lang === 'en' ? 'en' : 'fr'
    const alive = await deliver(sub, build(lang))
    if (!alive) await db.from('push_subscriptions').delete().eq('id', sub.id)
    else sent++
  }
  return sent
}

const membersOf = async (householdId: string) =>
  ((await db.from('household_members').select('user_id').eq('household_id', householdId)).data ?? []).map((m) => m.user_id as string)

// ——— Nouvelle dépense ———

async function onExpense(id: string) {
  const { data: e } = await db.from('expenses').select('*').eq('id', id).maybeSingle()
  if (!e) return
  const now = parisNow()
  // Restauration d'une sauvegarde ou saisie très ancienne: pas de notification.
  if (e.spent_on < shiftDate(now.date, -3)) return
  const [{ data: env }, { data: house }, members] = await Promise.all([
    db.from('envelopes').select('id, name, budget, month').eq('id', e.envelope_id).maybeSingle(),
    db.from('households').select('currency').eq('id', e.household_id).maybeSingle(),
    membersOf(e.household_id),
  ])
  if (!env) return
  const currency = (house?.currency as string) ?? 'EUR'
  const url = `${APP_URL}#/envelope/${env.id}`

  // 1. Les autres membres du foyer voient passer la dépense (pas les dépenses récurrentes automatiques).
  if (e.created_by && !e.recurring_id) {
    const { data: author } = await db.from('profiles').select('first_name').eq('id', e.created_by).maybeSingle()
    await sendTo(
      members.filter((m) => m !== e.created_by),
      'expenses',
      (lang) => ({
        title: env.name,
        body: TEXT[lang].added(author?.first_name || TEXT[lang].someone, money(Number(e.amount), lang, currency), e.note),
        url,
        tag: `expense-${e.id}`,
      }),
    )
  }

  // 2. Enveloppe du mois en cours qui approche de son budget, ou le dépasse (une seule fois chacune).
  const budget = Number(env.budget)
  if (env.month !== now.month || budget <= 0) return
  const { data: rows } = await db.from('expenses').select('amount, status').eq('envelope_id', env.id)
  const spent = (rows ?? []).filter((r) => r.status !== 'refunded').reduce((s, r) => s + Number(r.amount), 0)
  if (spent > budget) {
    await once(`env80:${env.id}`)
    if (await once(`env100:${env.id}`)) {
      await sendTo(members, 'envelopes', (lang) => ({ title: env.name, body: TEXT[lang].over(money(spent - budget, lang, currency)), url, tag: `env-${env.id}` }))
    }
  } else if (spent >= budget * 0.8 && (await once(`env80:${env.id}`))) {
    await sendTo(members, 'envelopes', (lang) => ({ title: env.name, body: TEXT[lang].at80(money(budget - spent, lang, currency)), url, tag: `env-${env.id}` }))
  }
}

// ——— Chaque heure: bilan du dimanche, rappel, nouveau mois ———

async function onTick() {
  const now = parisNow()
  const { data: houses } = await db.from('households').select('id, currency')
  for (const h of houses ?? []) {
    const members = await membersOf(h.id)
    if (members.length === 0) continue
    const currency = (h.currency as string) ?? 'EUR'
    const { data: envs } = await db
      .from('envelopes')
      .select('id, name, budget, expenses(amount, status, spent_on)')
      .eq('household_id', h.id)
      .eq('month', now.month)
    if (!envs || envs.length === 0) continue

    // Bilan de la semaine: dimanche, 19 h.
    if (now.weekday === 'Sun' && now.hour === 19 && (await once(`week:${h.id}:${now.date}`))) {
      const since = shiftDate(now.date, -6)
      const { data: week } = await db.from('expenses').select('amount, status').eq('household_id', h.id).gte('spent_on', since).lte('spent_on', now.date)
      const spentWeek = (week ?? []).filter((r) => r.status !== 'refunded').reduce((s, r) => s + Number(r.amount), 0)
      const over = envs
        .filter((e) => Number(e.budget) > 0)
        .filter((e) => ((e.expenses ?? []) as { amount: number; status: string }[]).filter((x) => x.status !== 'refunded').reduce((s, x) => s + Number(x.amount), 0) > Number(e.budget))
        .map((e) => e.name as string)
      await sendTo(members, 'weekly', (lang) => ({
        title: TEXT[lang].weekTitle,
        body: `${TEXT[lang].week(money(spentWeek, lang, currency))} ${over.length ? TEXT[lang].weekOver(over.slice(0, 3).join(', ')) : TEXT[lang].weekCalm}`,
        url: APP_URL,
        tag: 'weekly',
      }))
    }

    // Rien noté depuis 7 jours: un rappel, une seule fois par période calme.
    if (now.hour === 19 && now.day >= 8) {
      const { data: last } = await db.from('expenses').select('id, created_at').eq('household_id', h.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const quietSince = last ? new Date(last.created_at as string).getTime() : 0
      if (Date.now() - quietSince > 7 * 86_400_000 && (await once(`quiet:${h.id}:${last?.id ?? 'none'}`))) {
        await sendTo(members, 'reminders', (lang) => ({ title: TEXT[lang].quietTitle, body: TEXT[lang].quiet, url: APP_URL, tag: 'quiet' }))
      }
    }
  }

  // Nouveau mois: le 1er à 9 h (envoyé même si les enveloppes du mois ne sont pas encore créées).
  if (now.day === 1 && now.hour === 9) {
    for (const h of houses ?? []) {
      if (!(await once(`month:${h.id}:${now.month}`))) continue
      const members = await membersOf(h.id)
      await sendTo(members, 'reminders', (lang) => ({
        title: TEXT[lang].monthTitle,
        body: TEXT[lang].month(monthName(prevMonth(now.month), lang)),
        url: APP_URL,
        tag: 'month',
      }))
    }
  }
}

// ——— Point d'entrée ———

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  let payload: { type?: string; id?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'bad request' }, 400)
  }

  // Test depuis l'app: la personne connectée reçoit une notification sur tous ses appareils.
  if (payload.type === 'test') {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const { data } = await db.auth.getUser(token)
    if (!data.user) return json({ error: 'unauthorized' }, 401)
    const sent = await sendTo([data.user.id], null, (lang) => ({ title: TEXT[lang].testTitle, body: TEXT[lang].test, url: APP_URL, tag: 'test' }))
    return json({ sent })
  }

  // Appels de la base de données: vérifiés par le secret partagé.
  const secret = req.headers.get('x-bloom-secret') ?? ''
  const { data: ok } = await db.rpc('push_secret_ok', { candidate: secret })
  if (!ok) return json({ error: 'unauthorized' }, 401)

  if (payload.type === 'expense' && payload.id) await onExpense(payload.id)
  else if (payload.type === 'tick') await onTick()
  return json({ ok: true })
})
