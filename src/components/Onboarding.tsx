import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

export default function Onboarding({ onDone }: { onDone: (id: string) => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({})
  const [busy, setBusy] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErrors({ name: t('errNameRequired') })
    setBusy(true)
    const { data, error } = await supabase.rpc('create_household', { h_name: name.trim() })
    setBusy(false)
    if (error) setErrors({ name: t('errGeneric') })
    else onDone(data as string)
  }

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return setErrors({ code: t('errCodeRequired') })
    setBusy(true)
    const { data, error } = await supabase.rpc('join_household', { code: code.trim() })
    setBusy(false)
    if (error) setErrors({ code: t('errBadCode') })
    else onDone(data as string)
  }

  const input = 'w-full rounded-xl border border-border bg-surface px-4 py-3'
  const button = 'rounded-full bg-accent-strong px-4 py-3 font-medium text-white'

  return (
    <main className="fade-up mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4">
      <form onSubmit={create} noValidate className="flex flex-col gap-3">
        <div>
          <input
            className={input}
            placeholder={t('householdName')}
            aria-label={t('householdName')}
            aria-invalid={!!errors.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="mt-1 px-1 text-sm text-over">{errors.name}</p>}
        </div>
        <button disabled={busy} className={button}>{t('createHousehold')}</button>
      </form>
      <form onSubmit={join} noValidate className="flex flex-col gap-3">
        <div>
          <input
            className={input}
            placeholder={t('inviteCode')}
            aria-label={t('inviteCode')}
            aria-invalid={!!errors.code}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {errors.code && <p className="mt-1 px-1 text-sm text-over">{errors.code}</p>}
        </div>
        <button disabled={busy} className={button}>{t('joinHousehold')}</button>
      </form>
    </main>
  )
}
