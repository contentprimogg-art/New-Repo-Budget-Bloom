import { useTranslation } from 'react-i18next'
import { BADGE_COLORS, IconBadge, IconGlyph, ICON_KEYS, badgeColor } from '../lib/icons'

// Choix de l'icône (au trait, colorée comme la grille de catégories du moodboard) et de la couleur.
export default function IconPicker({
  icon,
  color,
  onChange,
}: {
  icon: string | null
  color: string | null
  onChange: (next: { icon: string | null; color: string | null }) => void
}) {
  const { t } = useTranslation()
  const current = badgeColor(color ?? BADGE_COLORS[0])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} color={color ?? BADGE_COLORS[0]} size="lg" />
        <p className="text-sm text-muted">{t('chooseIcon')}</p>
      </div>
      <div role="group" aria-label={t('chooseIcon')} className="grid grid-cols-7 gap-1 sm:grid-cols-9">
        {ICON_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={icon === key}
            aria-label={key}
            onClick={() => onChange({ icon: key, color: color ?? BADGE_COLORS[0] })}
            className={`grid aspect-square place-items-center rounded-2xl ${icon === key ? 'bg-accent-soft ring-2 ring-accent-strong' : 'hover:bg-accent-soft/60'}`}
          >
            <IconGlyph icon={key} color={icon === key ? current : 'var(--muted)'} size={21} />
          </button>
        ))}
      </div>
      <div role="group" aria-label={t('chooseColor')} className="flex flex-wrap gap-2.5">
        {BADGE_COLORS.map((c, n) => (
          <button
            key={c}
            type="button"
            aria-pressed={current === c}
            aria-label={`${t('chooseColor')} ${n + 1}`}
            onClick={() => onChange({ icon, color: c })}
            className={`size-8 rounded-full ${current === c ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}
