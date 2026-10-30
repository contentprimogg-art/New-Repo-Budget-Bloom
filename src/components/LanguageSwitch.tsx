import { useTranslation } from 'react-i18next'
import { setLanguage } from '../i18n'

export default function LanguageSwitch() {
  const { i18n } = useTranslation()
  return (
    <div className="flex justify-center gap-2 text-sm">
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLanguage(l)}
          className={`rounded-full px-3 py-1 ${i18n.language === l ? 'bg-accent-soft text-accent-strong' : 'text-muted'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
