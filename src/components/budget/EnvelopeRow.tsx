import { Repeat } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fmtMoney } from '../../lib/format'
import { useOptionalHousehold } from '../../lib/household'
import { IconBadge } from '../../lib/icons'
import { envelopeStats, type Envelope } from '../../lib/types'
import AvatarStack from '../ui/AvatarStack'
import ProgressBar from '../ui/ProgressBar'

// Une enveloppe dans la liste: pastille, nom, « Restant » ou « Dépassé de », dépensé / budget,
// et une fine barre de progression. Les lignes sont séparées par des pointillés (dans la liste parente).
export default function EnvelopeRow({
  envelope,
  spent,
  contributors = [],
  onOpen,
}: {
  envelope: Envelope
  spent: number
  contributors?: string[]
  onOpen: () => void
}) {
  const { t, i18n } = useTranslation()
  const household = useOptionalHousehold()
  const people = household?.shared ? contributors.map((id) => household.memberById[id]).filter((m) => !!m) : []
  const money = (n: number) => fmtMoney(n, i18n.language)
  const stats = envelopeStats(envelope.budget, spent)
  const over = stats.overBy > 0

  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full flex-col gap-2.5 py-3.5 text-left">
        <div className="flex w-full items-center gap-3">
          <IconBadge icon={envelope.icon} color={envelope.color} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[15px] font-medium">
              <span className="truncate">{envelope.name}</span>
              {envelope.recurring && <Repeat aria-label={t('recurringLabel')} size={12} className="shrink-0 text-muted" />}
            </p>
            <p className={`flex items-center gap-2 text-xs ${over ? 'font-semibold text-over' : 'text-muted'}`}>
              {over ? t('overBy', { amount: money(stats.overBy) }) : `${t('remaining')} : ${money(stats.remaining)}`}
              {people.length > 0 && <AvatarStack members={people} size={18} />}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-[15px] font-medium tabular-nums ${over ? 'text-over' : ''}`}>{money(stats.spent)}</p>
            <p className="text-xs tabular-nums text-muted">
              {stats.percent}% · {money(envelope.budget)}
            </p>
          </div>
        </div>
        <ProgressBar
          size="sm"
          spent={stats.spent}
          budget={envelope.budget}
          label={`${envelope.name}: ${money(stats.spent)} / ${money(envelope.budget)}`}
        />
      </button>
    </li>
  )
}
