import { useTranslation } from 'react-i18next'

// Barre de progression d'épargne divisée en sections par les paliers.
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
  const { t } = useTranslation()
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
        className="flex gap-0.5"
      >
        {sections.map((s) => {
          const fill = Math.min(1, Math.max(0, (balance - s.start) / (s.end - s.start)))
          return (
            <div
              key={s.end}
              className="h-3 overflow-hidden rounded-full bg-accent-soft"
              style={{ flexGrow: s.end - s.start, flexBasis: 0 }}
            >
              <div className="h-full rounded-full bg-accent-strong" style={{ width: `${fill * 100}%` }} />
            </div>
          )
        })}
      </div>
      <div className="relative h-5 text-xs">
        {stops.map((s, i) => {
          const done = balance >= s
          const last = i === stops.length - 1
          return (
            <span
              key={s}
              className={`absolute top-0 whitespace-nowrap ${done ? 'font-medium text-accent-strong' : 'text-muted'}`}
              style={{
                left: `${(s / goal) * 100}%`,
                transform: last ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {done && '✓ '}
              {format(s)}
            </span>
          )
        })}
      </div>
      {balance > goal && (
        <p className="text-xs font-medium text-accent-strong">{t('goalExceeded', { amount: format(balance - goal) })}</p>
      )}
    </div>
  )
}
