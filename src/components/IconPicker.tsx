import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export const ICONS = [
  '🛒', '🍽️', '🏠', '🚗', '⛽', '🎬', '🎮', '👗', '💄', '💊', '🐶', '🎁',
  '✈️', '📚', '🎓', '💡', '📱', '🧴', '☕', '🍷', '🏋️', '💐', '🧸', '🎧',
]

// Teintes pastel douces (fond de la pastille).
export const SWATCHES = ['#FBE6EF', '#F9DDE0', '#FFF1D6', '#E8F3EA', '#E6EEF9', '#EFE6F7', '#F3E9DC']

export function EnvelopeBadge({
  icon,
  color,
  className = 'size-10 text-lg',
}: {
  icon: string | null
  color: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full ${className}`}
      style={{ background: color ?? 'var(--accent-soft)' }}
    >
      {icon ?? '🌸'}
    </span>
  )
}

// Choix de l'icône et de la couleur d'une enveloppe (pastille façon appli de budget).
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
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-fit items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm text-muted hover:border-accent"
      >
        <EnvelopeBadge icon={icon} color={color} className="size-8 text-base" />
        {t('chooseIcon')}
      </button>
      {open && (
        <div className="fade-up flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3">
          <div role="group" aria-label={t('chooseIcon')} className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={icon === i}
                aria-label={i}
                onClick={() => onChange({ icon: i, color })}
                className={`grid aspect-square place-items-center rounded-xl text-xl ${
                  icon === i ? 'bg-accent-soft ring-2 ring-accent-strong' : 'hover:bg-accent-soft/60'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div role="group" aria-label={t('chooseColor')} className="flex flex-wrap gap-2">
            {SWATCHES.map((c, n) => (
              <button
                key={c}
                type="button"
                aria-pressed={color === c}
                aria-label={`${t('chooseColor')} ${n + 1}`}
                onClick={() => onChange({ icon, color: c })}
                className={`size-8 rounded-full border border-border ${color === c ? 'ring-2 ring-accent-strong ring-offset-2' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
