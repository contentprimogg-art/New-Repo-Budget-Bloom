import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { disablePush, enablePush, isPushOn, pushAvailability } from '../lib/push'
import { supabase } from '../lib/supabase'
import Card from './ui/Card'

type Pref = 'expenses' | 'envelopes' | 'weekly' | 'reminders'
const PREFS: Pref[] = ['expenses', 'envelopes', 'weekly', 'reminders']
type Prefs = Record<Pref, boolean>
const DEFAULTS: Prefs = { expenses: true, envelopes: true, weekly: true, reminders: true }

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-accent-strong' : 'bg-track'}`}
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

// Notifications: les activer sur cet appareil, choisir lesquelles recevoir (pour tous ses appareils), tester.
export default function NotificationsCard() {
  const { t, i18n } = useTranslation()
  const availability = pushAvailability()
  const [on, setOn] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr'

  useEffect(() => {
    void isPushOn().then(setOn)
    void supabase
      .from('notification_settings')
      .select('*')
      .maybeSingle()
      .then(({ data }) => data && setPrefs({ expenses: data.expenses, envelopes: data.envelopes, weekly: data.weekly, reminders: data.reminders }))
  }, [])

  // Les notifications arrivent dans la langue de l'app.
  useEffect(() => {
    if (on) void supabase.from('notification_settings').upsert({ lang, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }, [on, lang])

  const fail = (e: string) => {
    if (e === 'denied') return setMessage({ text: t('notifDenied'), tone: 'error' })
    setMessage({ text: /push_subscriptions|notification_settings/.test(e) ? t('errMigration0010') : `${t('errSave')} (${e})`, tone: 'error' })
  }

  async function toggle() {
    setBusy(true)
    setMessage(null)
    if (on) {
      await disablePush()
      setOn(false)
    } else {
      const e = await enablePush().catch((err: Error) => err.message)
      if (e) fail(e)
      else setOn(true)
    }
    setBusy(false)
  }

  async function setPref(key: Pref) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    const { error } = await supabase.from('notification_settings').upsert({ ...next, lang, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) fail(error.message)
  }

  async function test() {
    setBusy(true)
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('notify', { body: { type: 'test' } })
    setBusy(false)
    if (error) return setMessage({ text: t('notifTestFailed'), tone: 'error' })
    setMessage({ text: (data as { sent?: number })?.sent ? t('notifTestSent') : t('notifTestNone'), tone: (data as { sent?: number })?.sent ? 'ok' : 'error' })
  }

  return (
    <Card title={t('notifications')} description={t('notificationsHint')}>
      <div className="flex flex-col gap-4">
        {availability === 'ios-install' && <p className="rounded-2xl bg-accent-soft/60 px-4 py-3 text-sm">{t('notifIosInstall')}</p>}
        {availability === 'unsupported' && <p className="text-sm text-muted">{t('notifUnsupported')}</p>}
        {(availability === 'web' || availability === 'native') && (
          <label className="flex items-center justify-between gap-4">
            <span className="text-[15px]">{t('notifThisDevice')}</span>
            <Switch on={on} label={t('notifThisDevice')} onChange={() => void toggle()} disabled={busy} />
          </label>
        )}

        <div>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{t('notifWhich')}</p>
          <ul className="flex flex-col">
            {PREFS.map((key) => (
              <li key={key}>
                <button type="button" role="checkbox" aria-checked={prefs[key]} onClick={() => void setPref(key)} className="flex w-full items-start gap-3 py-2 text-left">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 ${prefs[key] ? 'border-accent-strong bg-accent-strong text-on-accent' : 'border-border'}`}
                  >
                    {prefs[key] && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block text-sm">{t(`notif_${key}`)}</span>
                    <span className="block text-xs text-muted">{t(`notif_${key}Hint`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {on && (
          <button type="button" disabled={busy} onClick={() => void test()} className="self-start text-sm font-medium text-accent-strong underline underline-offset-4">
            {t('notifTest')}
          </button>
        )}
        {message && <p className={`text-sm ${message.tone === 'ok' ? 'text-ok-ink' : 'text-over'}`}>{message.text}</p>}
      </div>
    </Card>
  )
}
