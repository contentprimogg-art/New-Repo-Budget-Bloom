import { Check, Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resizeToJpeg } from '../lib/avatar'
import { outboxCount } from '../lib/expenses'
import { downloadFile } from '../lib/files'
import { todayIso } from '../lib/format'
import { useProfile } from '../lib/profile'
import { parseBackup, restoreBackup, type Backup } from '../lib/restore'
import { signOut } from '../lib/session'
import { buildBackup } from '../lib/stats'
import { supabase } from '../lib/supabase'
import { PRESETS, applyPalette, customPalette, storePalette, type Palette } from '../lib/theme'
import Avatar from './Avatar'
import AvatarLink from './AvatarLink'
import ConfirmButton from './ConfirmButton'
import InviteCode from './InviteCode'
import LanguageSwitch from './LanguageSwitch'
import ScriptTitle from './ScriptTitle'
import { BottomNav } from './TabBar'
import Field, { PRIMARY, SECONDARY } from './ui/Field'
import PageHeader from './ui/PageHeader'

const section = 'flex flex-col gap-3 border-t border-dashed border-muted/35 pt-5'

export default function ProfilePage({ householdId }: { householdId: string }) {
  const { t } = useTranslation()
  const { userId, email, profile, avatarUrl, palette } = useProfile()
  const photoInput = useRef<HTMLInputElement>(null)
  const backupInput = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(profile.firstName ?? '')
  const [lastName, setLastName] = useState(profile.lastName ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<Palette>(palette ?? PRESETS[0])
  const [backup, setBackup] = useState<Backup | null>(null)

  const path = `${userId}/avatar.jpg`
  const done = (text: string) => {
    setError(null)
    setMessage(text)
  }
  const failed = (text: string) => {
    setMessage(null)
    setError(text)
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return failed(t('errNotImage'))
    setBusy(true)
    try {
      // 768 px: assez net pour l'écran de connexion, léger pour les pastilles.
      const blob = await resizeToJpeg(file, 768)
      const up = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const { error } = await supabase.auth.updateUser({ data: { avatar_path: path, avatar_version: Date.now() } })
      if (error) throw error
      done(t('photoSaved'))
    } catch (err) {
      failed(`${t('errSave')} (${(err as Error).message})`)
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto() {
    setBusy(true)
    const rm = await supabase.storage.from('avatars').remove([path])
    const { error } = await supabase.auth.updateUser({ data: { avatar_path: '', avatar_version: Date.now() } })
    setBusy(false)
    if (rm.error || error) return failed(`${t('errSave')} (${(rm.error ?? error)!.message})`)
    done(t('photoRemoved'))
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) return failed(t('errFirstNameRequired'))
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ data: { first_name: firstName.trim(), last_name: lastName.trim() } })
    setBusy(false)
    if (error) return failed(`${t('errSave')} (${error.message})`)
    done(t('profileSaved'))
  }

  async function choosePalette(p: Palette) {
    setCurrent(p)
    applyPalette(p)
    storePalette(p)
    const { error } = await supabase.auth.updateUser({ data: { palette: { id: p.id, accent: p.accent } } })
    if (error) failed(`${t('errSave')} (${error.message})`)
  }

  async function downloadBackup() {
    const r = await buildBackup(householdId)
    if (r.error || !r.json) return failed(`${t('errGeneric')} (${r.error})`)
    downloadFile(`budget-bloom-backup_${todayIso()}.json`, 'application/json', r.json)
    done(t('backupDone'))
  }

  async function onPickBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const parsed = parseBackup(await file.text())
    if (!parsed) return failed(t('errBadBackup'))
    setError(null)
    setBackup(parsed)
  }

  async function restore() {
    if (!backup) return
    setBusy(true)
    const err = await restoreBackup(householdId, backup)
    setBusy(false)
    if (err) return failed(`${t('errRestore')} (${err})`)
    setBackup(null)
    done(t('restoreDone'))
  }

  const input = 'field-line text-base'

  return (
    <main className="fade-up mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 pb-36 pt-[max(1.25rem,env(safe-area-inset-top))] md:pb-16">
      <PageHeader center={t('profileTitle')} right={<AvatarLink />} />

      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar className="size-28 text-4xl" />
        <ScriptTitle as="h1" className="text-5xl">
          {profile.firstName ?? t('profileTitle')}
        </ScriptTitle>
        <p className="-mt-2 text-sm text-muted">{email}</p>
        <input ref={photoInput} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
        <div className="flex items-center gap-3">
          <button disabled={busy} onClick={() => photoInput.current?.click()} className={SECONDARY}>
            {busy ? t('loading') : t('changePhoto')}
          </button>
          {avatarUrl && (
            <button disabled={busy} onClick={() => void removePhoto()} className="text-sm text-muted underline">
              {t('removePhoto')}
            </button>
          )}
        </div>
        <p className="text-xs text-muted">{t('photoHint')}</p>
      </div>

      {(message || error) && (
        <p role={error ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm ${error ? 'bg-over/10 text-over' : 'bg-accent-soft text-accent-strong'}`}>
          {error ?? message}
        </p>
      )}

      <form onSubmit={saveName} noValidate className={section}>
        <ScriptTitle>{t('identity')}</ScriptTitle>
        <Field label={t('firstNameLabel')} hint={t('firstNameHint')}>
          <input autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={input} />
        </Field>
        <Field label={t('lastNameLabel')}>
          <input autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={input} />
        </Field>
        <button disabled={busy} className={`${SECONDARY} self-start`}>
          {t('save')}
        </button>
      </form>

      <section className={section}>
        <ScriptTitle>{t('appearance')}</ScriptTitle>
        <p className="text-sm text-muted">{t('paletteHint')}</p>
        <div role="radiogroup" aria-label={t('palette')} className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[...PRESETS, customPalette(current.id === 'custom' ? current.accent : '#C2185B')].map((p) => {
            const selected = current.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => (p.id === 'custom' ? document.getElementById('custom-color')?.click() : void choosePalette(p))}
                className="flex flex-col items-center gap-1.5 text-xs"
              >
                <span className={`grid size-11 place-items-center rounded-full text-white ${selected ? 'ring-2 ring-text ring-offset-2 ring-offset-paper' : ''}`} style={{ background: p.accent }}>
                  {selected && <Check size={18} strokeWidth={2.6} />}
                </span>
                {t(`palette_${p.id}`)}
              </button>
            )
          })}
        </div>
        <input
          id="custom-color"
          type="color"
          value={current.accent}
          onChange={(e) => void choosePalette(customPalette(e.target.value))}
          className="sr-only"
          aria-label={t('palette_custom')}
        />
      </section>

      <section className={section}>
        <ScriptTitle>{t('language')}</ScriptTitle>
        <LanguageSwitch />
      </section>

      <section className={section}>
        <ScriptTitle>{t('household')}</ScriptTitle>
        <InviteCode householdId={householdId} />
      </section>

      <section className={section}>
        <ScriptTitle>{t('data')}</ScriptTitle>
        <p className="text-sm text-muted">{t('dataHint')}</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void downloadBackup()} className={`${SECONDARY} flex items-center gap-2`}>
            <Download size={16} /> {t('fullBackup')}
          </button>
          <input ref={backupInput} type="file" accept="application/json,.json" onChange={onPickBackup} className="hidden" />
          <button onClick={() => backupInput.current?.click()} className={`${SECONDARY} flex items-center gap-2`}>
            <Upload size={16} /> {t('restoreBackup')}
          </button>
        </div>
        {backup && (
          <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 text-sm shadow-sm">
            <p>
              {t('restoreSummary', {
                date: backup.exportedAt ? new Date(backup.exportedAt).toLocaleString() : '—',
                envelopes: backup.rows.envelopes.length,
                expenses: backup.rows.expenses.length,
                savings: backup.rows.savings_envelopes.length,
              })}
            </p>
            <p className="text-xs text-muted">{t('restoreHint')}</p>
            <div className="flex items-center gap-3">
              <button disabled={busy} onClick={() => void restore()} className={`${PRIMARY} w-auto`}>
                {busy ? t('loading') : t('restoreConfirm')}
              </button>
              <button onClick={() => setBackup(null)} className="text-muted underline">
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={`${section} items-center`}>
        {outboxCount() > 0 ? (
          <ConfirmButton
            label={t('signOut')}
            confirmLabel={t('signOutPending')}
            onConfirm={() => void signOut()}
            className="rounded-full border border-over/40 px-6 py-2.5 font-medium text-over"
            confirmClassName="rounded-full bg-over/10 px-6 py-2.5 font-semibold text-over"
          />
        ) : (
          <button onClick={() => void signOut()} className="rounded-full border border-over/40 px-6 py-2.5 font-medium text-over hover:bg-over/10">
            {t('signOut')}
          </button>
        )}
      </section>

      <BottomNav />
    </main>
  )
}
