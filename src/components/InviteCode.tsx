import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

export default function InviteCode({ householdId }: { householdId: string }) {
  const { t } = useTranslation()
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState(false)

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
  // Le code est masqué par défaut (écran visible par d'autres personnes).
  const btn = 'flex items-center gap-1.5 rounded-2xl border border-border px-3.5 py-2 text-sm hover:border-accent'
  return (
    <div className="no-print flex flex-wrap items-center gap-2.5">
      <code
        aria-label={shown ? code : t('inviteHidden')}
        className="rounded-2xl bg-accent-soft px-4 py-2 font-mono text-base font-semibold tracking-[0.2em] text-accent-strong"
      >
        {shown ? code : '•'.repeat(code.length)}
      </code>
      <button type="button" onClick={() => setShown(!shown)} aria-pressed={shown} className={btn}>
        {shown ? <EyeOff size={15} /> : <Eye size={15} />} {shown ? t('hide') : t('show')}
      </button>
      <button type="button" onClick={() => void copy()} className={btn}>
        {copied ? t('copied') : t('copy')}
      </button>
    </div>
  )
}
