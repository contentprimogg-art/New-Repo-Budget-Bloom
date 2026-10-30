import type { AuthError } from '@supabase/supabase-js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import AuthHero from './AuthHero'
import LanguageSwitch from './LanguageSwitch'
import ScriptTitle from './ScriptTitle'

type Errors = { firstName?: string; email?: string; password?: string; form?: string }

const savedName = (() => {
  try {
    return localStorage.getItem('bloomName')
  } catch {
    return null
  }
})()

const ERROR_KEYS: Record<string, string> = {
  invalid_credentials: 'errBadCredentials',
  user_already_exists: 'errAlreadyExists',
  email_not_confirmed: 'errNotConfirmed',
  weak_password: 'errPasswordShort',
  over_request_rate_limit: 'errRateLimit',
  over_email_send_rate_limit: 'errRateLimit',
}

export default function Auth() {
  const { t } = useTranslation()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [errors, setErrors] = useState<Errors>({})
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Message connu traduit; sinon message générique suivi du détail renvoyé par Supabase.
  function describe(error: AuthError): string {
    const key = ERROR_KEYS[error.code ?? '']
    if (key) return t(key)
    if (/sending|smtp|mail/i.test(error.message)) return `${t('errMailSend')} (${error.message})`
    return `${t('errGeneric')} (${error.message})`
  }

  function validate(): Errors {
    const e: Errors = {}
    if (mode === 'up' && !firstName.trim()) e.firstName = t('errFirstNameRequired')
    if (!email.trim()) e.email = t('errEmailRequired')
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = t('errEmailInvalid')
    if (!password) e.password = t('errPasswordRequired')
    else if (mode === 'up' && password.length < 6) e.password = t('errPasswordShort')
    return e
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    const creds = { email: email.trim(), password }
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword(creds)
      if (error) setErrors({ form: describe(error) })
    } else {
      const { data, error } = await supabase.auth.signUp({
        ...creds,
        options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
      })
      if (error) setErrors({ form: describe(error) })
      else if (!data.session) setSentTo(creds.email)
    }
    setBusy(false)
  }

  function switchMode() {
    setMode(mode === 'in' ? 'up' : 'in')
    setErrors({})
  }

  const input = 'w-full rounded-2xl border border-border bg-surface px-4 py-3'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-6 md:max-w-4xl md:flex-row md:items-center md:gap-14">
      <div className="fade-up md:w-1/2">
        <AuthHero greetingName={mode === 'in' ? savedName : null} />
      </div>

      <div className="fade-up flex flex-col gap-5 md:w-1/2">
        <div className="text-center md:text-left">
          <ScriptTitle as="h1" className="text-6xl">
            Budget Bloom
          </ScriptTitle>
          <p className="mt-1 text-sm text-muted">{mode === 'in' ? t('welcomeBack') : t('welcomeNew')}</p>
        </div>

        {sentTo ? (
          <div role="status" className="flex flex-col gap-3 rounded-3xl bg-accent-soft p-5 text-center">
            <p className="font-medium">{t('checkInbox')}</p>
            <p className="text-sm text-muted">{t('confirmationSent', { email: sentTo })}</p>
            <button
              type="button"
              onClick={() => {
                setSentTo(null)
                setMode('in')
              }}
              className="text-sm text-accent-strong underline"
            >
              {t('backToSignIn')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            {mode === 'up' && (
              <>
                <div>
                  <input
                    autoComplete="given-name"
                    placeholder={t('firstNameLabel')}
                    aria-label={t('firstNameLabel')}
                    aria-invalid={!!errors.firstName}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={input}
                  />
                  {errors.firstName ? (
                    <p className="mt-1 px-2 text-sm text-over">{errors.firstName}</p>
                  ) : (
                    <p className="mt-1 px-2 text-xs text-muted">{t('firstNameHint')}</p>
                  )}
                </div>
                <input
                  autoComplete="family-name"
                  placeholder={t('lastNameLabel')}
                  aria-label={t('lastNameLabel')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={input}
                />
              </>
            )}
            <div>
              <input
                type="email"
                autoComplete="email"
                placeholder={t('email')}
                aria-label={t('email')}
                aria-invalid={!!errors.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
              />
              {errors.email && <p className="mt-1 px-2 text-sm text-over">{errors.email}</p>}
            </div>
            <div>
              <input
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                placeholder={t('password')}
                aria-label={t('password')}
                aria-invalid={!!errors.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
              {errors.password && <p className="mt-1 px-2 text-sm text-over">{errors.password}</p>}
            </div>
            {errors.form && (
              <p role="alert" className="rounded-2xl bg-over/10 px-4 py-3 text-sm text-over">
                {errors.form}
              </p>
            )}
            <button
              disabled={busy}
              className="mt-1 rounded-full bg-accent-strong px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-accent/30"
            >
              {busy ? t('loading') : mode === 'in' ? t('signIn') : t('signUp')}
            </button>
            <button type="button" onClick={switchMode} className="text-sm text-muted underline">
              {mode === 'in' ? t('noAccountYet') : t('alreadyHaveAccount')}
            </button>
          </form>
        )}
        <LanguageSwitch />
      </div>
    </main>
  )
}
