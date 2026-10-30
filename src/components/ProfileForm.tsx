import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

// Prénom (ou pseudo) et nom facultatif, stockés dans les métadonnées du compte.
export default function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(profile.firstName ?? '')
  const [lastName, setLastName] = useState(profile.lastName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) return setError(t('errFirstNameRequired'))
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    })
    if (error) return setError(`${t('errSave')} (${error.message})`)
    setError(null)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const input = 'w-full rounded-2xl border border-border bg-surface px-3 py-2'

  return (
    <section className="no-print flex flex-col gap-2 rounded-3xl border border-border bg-surface p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{t('profileTitle')}</p>
          <p className="text-muted">
            {profile.firstName ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : t('profileNone')}
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => {
              setFirstName(profile.firstName ?? '')
              setLastName(profile.lastName ?? '')
              setEditing(true)
            }}
            className="text-accent-strong underline"
          >
            {t('edit')}
          </button>
        )}
      </div>
      {saved && <p role="status" className="text-accent-strong">{t('profileSaved')}</p>}
      {editing && (
        <form onSubmit={save} noValidate className="fade-up flex flex-col gap-2">
          <input
            autoComplete="given-name"
            placeholder={t('firstNameLabel')}
            aria-label={t('firstNameLabel')}
            aria-invalid={!!error}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={input}
          />
          <p className="px-1 text-xs text-muted">{t('firstNameHint')}</p>
          <input
            autoComplete="family-name"
            placeholder={t('lastNameLabel')}
            aria-label={t('lastNameLabel')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={input}
          />
          {error && <p className="px-1 text-over">{error}</p>}
          <div className="flex gap-2">
            <button className="flex-1 rounded-full bg-accent-strong px-4 py-2 font-medium text-white">{t('save')}</button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full bg-accent-soft px-4 py-2 text-accent-strong"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
