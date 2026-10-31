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

  // Contenu seul: le titre et l'explication sont portés par la carte qui l'entoure.
  return (
    <div className="no-print flex items-center gap-3">
      <code className="rounded-2xl bg-accent-soft px-4 py-2 text-base font-semibold tracking-[0.2em] text-accent-strong">{code}</code>
      <button onClick={() => void copy()} className="rounded-full border border-border px-4 py-2 text-sm hover:border-accent">
        {copied ? t('copied') : t('copy')}
      </button>
    </div>
  )
}
