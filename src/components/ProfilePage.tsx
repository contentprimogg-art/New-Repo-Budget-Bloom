import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resizeToJpeg } from '../lib/avatar'
import { useProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'
import InviteCode from './InviteCode'
import LanguageSwitch from './LanguageSwitch'
import ScriptTitle from './ScriptTitle'

const card = 'flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5 shadow-sm'
const input = 'w-full rounded-2xl border border-border bg-surface px-4 py-3'

export default function ProfilePage({ householdId }: { householdId: string }) {
  const { t } = useTranslation()
  const { userId, email, profile, avatarUrl } = useProfile()
  const fileInput = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(profile.firstName ?? '')
  const [lastName, setLastName] = useState(profile.lastName ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const path = `${userId}/avatar.jpg`

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setError(t('errNotImage'))
    setBusy(true)
    setError(null)
    try {
      const blob = await resizeToJpeg(file)
      const up = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const { error } = await supabase.auth.updateUser({ data: { avatar_path: path, avatar_version: Date.now() } })
      if (error) throw error
      setMessage(t('photoSaved'))
    } catch (err) {
      setError(`${t('errSave')} (${(err as Error).message})`)
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto() {
    setBusy(true)
    setError(null)
    const rm = await supabase.storage.from('avatars').remove([path])
    const { error } = await supabase.auth.updateUser({ data: { avatar_path: '', avatar_version: Date.now() } })
    setBusy(false)
    if (rm.error || error) return setError(`${t('errSave')} (${(rm.error ?? error)!.message})`)
    setMessage(t('photoRemoved'))
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) return setError(t('errFirstNameRequired'))
    setBusy(true)
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    })
    setBusy(false)
    if (error) return setError(`${t('errSave')} (${error.message})`)
    setError(null)
    setMessage(t('profileSaved'))
  }

  return (
    <main className="fade-up mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-xl">
      <header className="flex items-center justify-between">
        <a href="#/" className="text-sm text-muted underline">
          ← {t('back')}
        </a>
      </header>
      <ScriptTitle as="h1" className="text-5xl">
        {t('profileTitle')}
      </ScriptTitle>
      <p className="-mt-2 text-sm text-muted">{email}</p>

      {(message || error) && (
        <p
          role={error ? 'alert' : 'status'}
          className={`rounded-2xl px-4 py-3 text-sm ${error ? 'bg-over/10 text-over' : 'bg-accent-soft text-accent-strong'}`}
        >
          {error ?? message}
        </p>
      )}

      <section className={`${card} sm:flex-row sm:items-center`}>
        <Avatar className="size-24 text-4xl" />
        <div className="flex flex-col items-start gap-2">
          <input ref={fileInput} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          <button
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="rounded-full bg-accent-strong px-5 py-2.5 text-sm font-medium text-white"
          >
            {busy ? t('loading') : t('changePhoto')}
          </button>
          {avatarUrl && (
            <button disabled={busy} onClick={() => void removePhoto()} className="px-1 text-sm text-muted underline">
              {t('removePhoto')}
            </button>
          )}
          <p className="text-xs text-muted">{t('photoHint')}</p>
        </div>
      </section>

      <form onSubmit={saveName} noValidate className={card}>
        <input
          autoComplete="given-name"
          placeholder={t('firstNameLabel')}
          aria-label={t('firstNameLabel')}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={input}
        />
        <p className="-mt-1 px-2 text-xs text-muted">{t('firstNameHint')}</p>
        <input
          autoComplete="family-name"
          placeholder={t('lastNameLabel')}
          aria-label={t('lastNameLabel')}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={input}
        />
        <button disabled={busy} className="rounded-full bg-accent-soft px-5 py-2.5 font-medium text-accent-strong">
          {t('save')}
        </button>
      </form>

      <section className={card}>
        <p className="font-medium">{t('language')}</p>
        <LanguageSwitch />
      </section>

      <InviteCode householdId={householdId} />

      <button
        onClick={() => supabase.auth.signOut()}
        className="rounded-full border border-over/40 px-5 py-3 font-medium text-over hover:bg-over/10"
      >
        {t('signOut')}
      </button>
    </main>
  )
}
