import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'
import Card from './ui/Card'
import Field, { SECONDARY } from './ui/Field'

type Stage = 'details' | 'await-confirmations' | 'done'

export default function ChangeEmailCard() {
  const { t } = useTranslation()
  const { email } = useProfile()
  const [password, setPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [stage, setStage] = useState<Stage>('details')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const visibleStage =
    stage === 'await-confirmations' && email.toLowerCase() === newEmail.toLowerCase() ? 'done' : stage

  async function requestChange(event: React.FormEvent) {
    event.preventDefault()
    const nextEmail = newEmail.trim()
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) return setError(t('errEmailInvalid'))
    if (nextEmail.toLowerCase() === email.toLowerCase()) return setError(t('emailUnchanged'))
    if (!password) return setError(t('errPasswordRequired'))

    setBusy(true)
    setError(null)
    setMessage(null)
    const reauthenticated = await supabase.auth.signInWithPassword({ email, password })
    if (reauthenticated.error) {
      setBusy(false)
      return setError(t('errBadCredentials'))
    }

    const { error: changeError } = await supabase.auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo: window.location.origin },
    )
    setBusy(false)
    if (changeError) return setError(`${t('emailChangeFailed')} (${changeError.message})`)

    setNewEmail(nextEmail)
    setPassword('')
    setStage('await-confirmations')
    setMessage(t('emailChangeRequested', { email, newEmail: nextEmail }))
  }

  return (
    <Card title={t('changeEmailTitle')} description={t('changeEmailHint')}>
      {message && <p role="status" className="mb-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-2xl bg-over/10 px-4 py-3 text-sm text-over">{error}</p>}

      {visibleStage === 'details' && (
        <form onSubmit={requestChange} noValidate className="flex flex-col gap-4">
          <Field label={t('currentEmail')}>
            <input value={email} readOnly className="field-line w-full text-base opacity-70" />
          </Field>
          <Field label={t('currentPassword')}>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-line w-full text-base"
            />
          </Field>
          <Field label={t('newEmail')}>
            <input
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="field-line w-full text-base"
            />
          </Field>
          <button disabled={busy} className={`${SECONDARY} self-start`}>
            {busy ? t('loading') : t('sendEmailChange')}
          </button>
        </form>
      )}

      {visibleStage === 'await-confirmations' && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">{t('emailChangeAwaitingLink', { email: newEmail })}</p>
        </div>
      )}

      {visibleStage === 'done' && <p className="text-sm text-muted">{t('emailChangeComplete')}</p>}
    </Card>
  )
}
