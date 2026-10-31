import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fmtMoneyShort } from '../lib/format'

// Barre de progression d'épargne (fond gris, progression colorée), découpée en sections par les paliers.
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
  const short = (n: number) => fmtMoneyShort(n, i18n.language)
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
            <div key={s.end} className="h-3 overflow-hidden rounded-full bg-track" style={{ flexGrow: s.end - s.start, flexBasis: 0 }}>
              <div className="h-full rounded-full bg-accent-strong transition-[width] duration-500" style={{ width: `${fill * 100}%` }} />
            </div>
          )
        })}
      </div>
      <div className="grid text-[10px]" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}>
        {stops.map((s) => {
          const done = balance >= s
          return (
            <span
              key={s}
              className={`flex min-w-0 items-center justify-center gap-0.5 text-center tabular-nums [overflow-wrap:anywhere] ${done ? 'font-semibold text-accent-strong' : 'text-muted'}`}
            >
              {done && <Check className="shrink-0" size={11} strokeWidth={3} />}
              {short(s)}
            </span>
          )
        })}
      </div>
      {balance > goal && <p className="text-xs font-medium text-accent-strong">{t('goalExceeded', { amount: format(balance - goal) })}</p>}
    </div>
  )
}
