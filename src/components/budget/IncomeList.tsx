import { CloudOff, Repeat } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useOptionalHousehold } from '../../lib/household'
import { IconBadge } from '../../lib/icons'
import type { Income } from '../../lib/types'
import { MemberAvatar } from '../ui/AvatarStack'
import Card from '../ui/Card'

// Revenus du mois (section « Revenus » du moodboard): pastille, libellé, date, montant en vert.
export default function IncomeList({ incomes, onEdit }: { incomes: Income[]; onEdit: (income: Income) => void }) {
  const { t, i18n } = useTranslation()
  const household = useOptionalHousehold()
  if (incomes.length === 0) return <Card description={t('noIncomes')} />
  return (
    <Card>
      <ul className="-my-2 divide-y divide-dashed divide-muted/30">
        {incomes.map((income) => {
          const author = income.created_by ? household?.memberById[income.created_by] : undefined
          return (
            <li key={income.id}>
              <button type="button" onClick={() => onEdit(income)} className="flex w-full items-center gap-3 py-3 text-left">
                <IconBadge icon={income.icon ?? '💶'} color={income.color ?? '#E2F3E6'} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-[15px]">
                    <span className="truncate">{income.label}</span>
                    {income.recurring && <Repeat aria-label={t('incomeRecurring')} size={12} className="shrink-0 text-muted" />}
                    {income.pending && <CloudOff aria-label={t('pendingOne')} size={12} className="shrink-0 text-muted" />}
                  </span>
                  <span className="text-xs text-muted">{fmtDate(income.received_on, i18n.language)}</span>
                </span>
                {household?.shared && author && <MemberAvatar member={author} size={20} />}
                <span className="min-w-0 max-w-[48%] text-right text-[15px] font-medium tabular-nums text-ok-ink [overflow-wrap:anywhere]">
                  +{fmtMoney(income.amount, i18n.language)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
