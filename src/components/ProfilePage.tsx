import { Check, Download, Moon, Sun, SunMoon, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCEPT, isImageFile, prepareAvatar } from '../lib/avatar'
import { outboxCount } from '../lib/expenses'
import { downloadFile } from '../lib/files'
import { todayIso } from '../lib/format'
import { useProfile } from '../lib/profile'
import { parseBackup, restoreBackup, type Backup } from '../lib/restore'
import { signOut } from '../lib/session'
import { buildBackup } from '../lib/stats'
import { supabase } from '../lib/supabase'
import {
  PRESETS,
  applyPalette,
  applyThemeMode,
  customPalette,
  storePalette,
  storeThemeMode,
  storedThemeMode,
  type Palette,
  type ThemeMode,
} from '../lib/theme'
import Avatar from './Avatar'
import ConfirmButton from './ConfirmButton'
import HouseholdCard from './HouseholdCard'
import LanguageSwitch from './LanguageSwitch'
import Card from './ui/Card'
import ColorSheet from './ui/ColorSheet'
import Field, { PRIMARY, SECONDARY } from './ui/Field'
import PageShell from './ui/PageShell'
import PhotoViewer from './ui/PhotoViewer'

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
  const [viewer, setViewer] = useState(false)
  const [picking, setPicking] = useState(false)
  const [mode, setMode] = useState<ThemeMode>(storedThemeMode)

  const photoPaths = [`${userId}/avatar.jpg`, `${userId}/avatar.gif`]
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
    if (!isImageFile(file)) return failed(t('errNotImage'))
    setBusy(true)
    try {
      const { blob, ext, type } = await prepareAvatar(file)
      const path = `${userId}/avatar.${ext}`
      const up = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: type })
      if (up.error) throw up.error
      // L'ancienne photo dans l'autre format (JPEG ou GIF) est retirée.
      await supabase.storage.from('avatars').remove(photoPaths.filter((x) => x !== path))
      const { error } = await supabase.auth.updateUser({ data: { avatar_path: path, avatar_version: Date.now() } })
      if (error) throw error
      done(t('photoSaved'))
    } catch (err) {
      const msg = (err as Error).message
      failed(/mime|size|too large|payload/i.test(msg) ? t('errMigration0007') : `${t('errPhoto')} (${msg})`)
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto() {
    setBusy(true)
    const rm = await supabase.storage.from('avatars').remove(photoPaths)
    const { error } = await supabase.auth.updateUser({ data: { avatar_path: '', avatar_version: Date.now() } })
    setBusy(false)
    if (rm.error || error) return failed(`${t('errSave')} (${(rm.error ?? error)!.message})`)
    done(t('photoRemoved'))
  }

  function chooseMode(next: ThemeMode) {
    setMode(next)
    applyThemeMode(next)
    storeThemeMode(next)
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

  const custom = current.id === 'custom' ? current : customPalette('#C2185B')

  return (
    <PageShell title={t('profileTab')} subtitle={email} action="home">
      {(message || error) && (
        <p role={error ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm ${error ? 'bg-over/10 text-over' : 'bg-accent-soft text-accent-strong'}`}>
          {error ?? message}
        </p>
      )}

      <Card>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => avatarUrl && setViewer(true)}
            disabled={!avatarUrl}
            aria-label={t('profilePhoto')}
            className="shrink-0 rounded-full disabled:opacity-100"
          >
            <Avatar className="size-24 text-4xl" />
          </button>
          <div className="flex min-w-0 flex-col items-start gap-2">
            <p className="truncate text-lg font-medium">{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || t('profileNone')}</p>
            <input ref={photoInput} type="file" accept={ACCEPT} onChange={onPickPhoto} className="hidden" />
            <button disabled={busy} onClick={() => photoInput.current?.click()} className="rounded-2xl border border-border px-4 py-2 text-sm hover:border-accent">
              {busy ? t('loading') : t('changePhoto')}
            </button>
            {avatarUrl && (
              <button disabled={busy} onClick={() => void removePhoto()} className="text-sm text-muted underline">
                {t('removePhoto')}
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{t('photoHint')}</p>
      </Card>

      <Card title={t('identity')} description={t('firstNameHint')}>
        <form onSubmit={saveName} noValidate className="flex flex-col gap-4">
          <Field label={t('firstNameLabel')}>
            <input autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field-line text-base" />
          </Field>
          <Field label={t('lastNameLabel')}>
            <input autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="field-line text-base" />
          </Field>
          <button disabled={busy} className={`${SECONDARY} self-start`}>
            {t('save')}
          </button>
        </form>
      </Card>

      <Card title={t('appearance')} description={t('paletteHint')}>
        <div role="radiogroup" aria-label={t('theme')} className="mb-5 inline-flex rounded-2xl border border-border bg-surface p-1 text-sm">
          {(
            [
              ['auto', SunMoon, t('themeAuto')],
              ['light', Sun, t('themeLight')],
              ['dark', Moon, t('themeDark')],
            ] as const
          ).map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => chooseMode(m)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 ${mode === m ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted'}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={t('palette')} className="grid grid-cols-3 gap-y-4 sm:grid-cols-6">
          {[...PRESETS, custom].map((p) => {
            const selected = current.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => (p.id === 'custom' ? setPicking(true) : void choosePalette(p))}
                className="flex flex-col items-center gap-1.5 text-xs"
              >
                <span
                  className={`grid size-11 place-items-center rounded-full text-white ${selected ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`}
                  style={{ background: p.id === 'custom' && !selected ? `conic-gradient(${PRESETS.map((x) => x.accent).join(',')}, ${PRESETS[0].accent})` : p.accent }}
                >
                  {selected && <Check size={18} strokeWidth={2.6} />}
                </span>
                {t(`palette_${p.id}`)}
              </button>
            )
          })}
        </div>
      </Card>

      <Card title={t('language')} description={t('languageHint')} action={<LanguageSwitch full />} />

      <HouseholdCard userId={userId} />

      <Card title={t('data')} description={t('dataHint')}>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void downloadBackup()} className="flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm hover:border-accent">
            <Download size={16} /> {t('fullBackup')}
          </button>
          <input ref={backupInput} type="file" accept="application/json,.json" onChange={onPickBackup} className="hidden" />
          <button onClick={() => backupInput.current?.click()} className="flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm hover:border-accent">
            <Upload size={16} /> {t('restoreBackup')}
          </button>
        </div>
        {backup && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-accent-soft/50 p-4 text-sm">
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
      </Card>

      {outboxCount() > 0 ? (
        <ConfirmButton
          label={t('signOut')}
          confirmLabel={t('signOutPending')}
          onConfirm={() => void signOut()}
          className="w-full rounded-3xl border border-border bg-surface py-4 font-medium text-over"
          confirmClassName="w-full rounded-3xl bg-over/10 py-4 font-semibold text-over"
        />
      ) : (
        <button onClick={() => void signOut()} className="w-full rounded-3xl border border-border bg-surface py-4 font-medium text-over hover:bg-over/5">
          {t('signOut')}
        </button>
      )}

      {viewer && avatarUrl && <PhotoViewer url={avatarUrl} onClose={() => setViewer(false)} />}
      {picking && (
        <ColorSheet title={t('palette_custom')} value={custom.accent} onClose={() => setPicking(false)} onPick={(hex) => void choosePalette(customPalette(hex))} />
      )}
    </PageShell>
  )
}
