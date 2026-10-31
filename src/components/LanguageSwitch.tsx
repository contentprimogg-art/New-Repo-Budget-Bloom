import { useTranslation } from 'react-i18next'
import { setLanguage } from '../i18n'

const LABELS = { fr: 'Français', en: 'English' } as const

// Sélecteur de langue en contrôle segmenté; « full » affiche les noms complets (page Profil).
export default function LanguageSwitch({ full = false }: { full?: boolean }) {
  const { i18n } = useTranslation()
  return (
    <div role="group" aria-label="Langue / Language" className="inline-flex rounded-2xl border border-border bg-surface p-1 text-sm">
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={i18n.language === l}
          onClick={() => setLanguage(l)}
          className={`rounded-xl px-3.5 py-1.5 ${i18n.language === l ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted'}`}
        >
          {full ? LABELS[l] : l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
