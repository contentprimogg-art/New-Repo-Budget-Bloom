import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const stripes = (color: string) => `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 5px)`

// Barre de progression d'épargne en rayures, découpée en sections par les paliers.
// Sans objectif explicite, le plus grand palier sert d'objectif.
export default function MilestoneBar({
  balance,
  target,
  milestones,
  format,
}: {
  balance: number
  target: number | null
  milestones: number[]
  format: (n: number) => string
}) {
  const { t, i18n } = useTranslation()
  // Étiquettes sans centimes: plus courtes, elles ne se chevauchent pas entre paliers proches.
  const short = (n: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const goal = target ?? (milestones.length ? Math.max(...milestones) : null)
  if (!goal) return null

  // Bornes hautes de chaque section: les paliers inférieurs à l'objectif, puis l'objectif.
  const stops = [...new Set([...milestones.filter((m) => m < goal), goal])].sort((a, b) => a - b)
  const sections = stops.map((end, i) => ({ start: i === 0 ? 0 : stops[i - 1], end }))
  const reached = stops.filter((s) => balance >= s).length

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={t('milestoneAria', { balance: format(balance), goal: format(goal), reached, total: stops.length })}
        className="flex gap-[3px]"
      >
        {sections.map((s) => {
          const fill = Math.min(1, Math.max(0, (balance - s.start) / (s.end - s.start)))
          return (
            <div key={s.end} className="h-4 overflow-hidden" style={{ flexGrow: s.end - s.start, flexBasis: 0, backgroundImage: stripes('var(--border)') }}>
              <div className="h-full" style={{ width: `${fill * 100}%`, backgroundImage: stripes('var(--accent-strong)') }} />
            </div>
          )
        })}
      </div>
      <div className="relative h-5 text-[11px]">
        {stops.map((s, i) => {
          const done = balance >= s
          const last = i === stops.length - 1
          return (
            <span
              key={s}
              className={`absolute top-0 flex items-center gap-0.5 whitespace-nowrap tabular-nums ${done ? 'font-semibold text-accent-strong' : 'text-muted'}`}
              style={{ left: `${(s / goal) * 100}%`, transform: last ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              {done && <Check size={11} strokeWidth={3} />}
              {short(s)}
            </span>
          )
        })}
      </div>
      {balance > goal && <p className="text-xs font-medium text-accent-strong">{t('goalExceeded', { amount: format(balance - goal) })}</p>}
    </div>
  )
}
