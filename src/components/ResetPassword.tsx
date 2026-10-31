import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ScriptTitle from './ScriptTitle'
import { supabase } from '../lib/supabase'

export default function ResetPassword({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 6) return setError(t('errPasswordShort'))
    if (password !== confirmation) return setError(t('passwordsDoNotMatch'))

    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) return setError(`${t('errSave')} (${updateError.message})`)
    onComplete()
  }

  const input = 'field-line w-full text-base'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-5 py-8">
      <div className="text-center">
        <ScriptTitle as="h1" className="text-6xl">Budget Bloom</ScriptTitle>
        <p className="mt-2 text-sm text-muted">{t('chooseNewPassword')}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <input
          type="password"
          autoComplete="new-password"
          aria-label={t('newPassword')}
          placeholder={t('newPassword')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={input}
        />
        <input
          type="password"
          autoComplete="new-password"
          aria-label={t('confirmNewPassword')}
          placeholder={t('confirmNewPassword')}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={input}
        />
        {error && <p role="alert" className="rounded-2xl bg-over/10 px-4 py-3 text-sm text-over">{error}</p>}
        <button disabled={busy} className="rounded-full bg-accent-strong px-6 py-3.5 font-semibold text-on-accent">
          {busy ? t('loading') : t('saveNewPassword')}
        </button>
      </form>
    </main>
  )
}
