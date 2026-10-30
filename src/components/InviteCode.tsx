import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

export default function InviteCode({ householdId }: { householdId: string }) {
  const { t } = useTranslation()
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void supabase
      .from('households')
      .select('invite_code')
      .eq('id', householdId)
      .maybeSingle()
      .then(({ data }) => setCode(data?.invite_code ?? null))
  }, [householdId])

  if (!code) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(code!)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* presse-papiers indisponible (HTTP): le code reste affiché pour le recopier à la main */
    }
  }

  return (
    <section className="no-print flex flex-col gap-1 rounded-3xl bg-accent-soft p-4 text-sm">
      <p className="font-medium">{t('inviteTitle')}</p>
      <p className="text-muted">{t('inviteHint')}</p>
      <div className="mt-1 flex items-center gap-3">
        <code className="rounded-xl bg-surface px-3 py-1.5 text-base font-semibold tracking-widest">{code}</code>
        <button onClick={() => void copy()} className="text-accent-strong underline">
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </section>
  )
}
