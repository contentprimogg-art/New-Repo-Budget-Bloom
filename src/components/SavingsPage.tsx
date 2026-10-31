import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney } from '../lib/format'
import { IconBadge, colorForIndex } from '../lib/icons'
import { useHash } from '../lib/route'
import { childrenOf, milestonesOf, totalOf, useSavings } from '../lib/savings'
import AvatarLink from './AvatarLink'
import MilestoneBar from './MilestoneBar'
import SavingsDetail from './SavingsDetail'
import ScriptTitle from './ScriptTitle'
import SavingsSheet from './savings/SavingsSheet'
import TabBar, { BottomNav } from './TabBar'
import PageHeader from './ui/PageHeader'
import SummaryColumns from './ui/SummaryColumns'

const PREFIX = '#/savings/'

export default function SavingsPage({ householdId }: { householdId: string }) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const hash = useHash()
  const { data, error, loaded, reload } = useSavings(householdId)
  const [creating, setCreating] = useState(false)

  const selectedId = hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null
  const selected = data && selectedId ? data.envelopes.find((e) => e.id === selectedId) : undefined
  if (data && selected) {
    return <SavingsDetail data={data} envelope={selected} householdId={householdId} reload={reload} />
  }

  const top = data?.envelopes.filter((e) => !e.parent_id) ?? []
  const grandTotal = data ? top.reduce((sum, e) => sum + totalOf(data, e.id), 0) : 0
  const goals = top.reduce((sum, e) => sum + (e.target ?? 0), 0)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 pb-36 pt-[max(1.25rem,env(safe-area-inset-top))] md:pb-16">
      <PageHeader center={t('tabSavings')} right={<AvatarLink />} />
      <div className="-mt-2 flex justify-center">
        <TabBar />
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-over/10 px-4 py-3 text-sm text-over">
          <p>{/savings_/.test(error) ? t('errMigrationSavings') : t('errLoad')}</p>
          <p className="mt-1 text-xs opacity-80">{error}</p>
        </div>
      )}

      {data && (
        <>
          <ScriptTitle>{t('summaryTitle')}</ScriptTitle>
          <SummaryColumns
            items={[
              { label: t('savedSoFar'), value: money(grandTotal), tone: 'var(--accent-strong)' },
              { label: t('goals'), value: goals ? money(goals) : '—', tone: 'var(--chart-2)' },
              { label: t('leftShort'), value: goals ? money(Math.max(goals - grandTotal, 0)) : '—', tone: 'var(--ok)' },
            ]}
          />
        </>
      )}

      <ScriptTitle>{t('savingsEnvelopes')}</ScriptTitle>
      {loaded && data && top.length === 0 && <p className="text-sm text-muted">{t('noSavings')}</p>}
      <ul className="divide-y divide-dashed divide-muted/30">
        {data &&
          top.map((e) => {
            const total = totalOf(data, e.id)
            const kids = childrenOf(data, e.id)
            return (
              <li key={e.id}>
                <a href={`${PREFIX}${e.id}`} className="flex flex-col gap-2.5 py-3.5">
                  <div className="flex items-center gap-3">
                    <IconBadge icon={e.icon ?? 'piggy'} color={e.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{e.name}</p>
                      <p className="text-xs text-muted">
                        {e.target ? t('goalOf', { amount: money(e.target) }) : t('noGoal')}
                        {kids.length > 0 && ` · ${t('subEnvelopesCount', { count: kids.length })}`}
                      </p>
                    </div>
                    <span className="text-[15px] font-medium tabular-nums">{money(total)}</span>
                  </div>
                  <MilestoneBar balance={total} target={e.target} milestones={milestonesOf(data, e.id)} format={money} />
                </a>
              </li>
            )
          })}
      </ul>
      {data && (
        <button
          onClick={() => setCreating(true)}
          className="no-print flex items-center justify-center gap-2 rounded-full border border-dashed border-accent py-3 text-sm font-medium text-accent-strong hover:bg-accent-soft/50"
        >
          <Plus size={16} /> {t('addSavings')}
        </button>
      )}

      <BottomNav />
      {creating && (
        <SavingsSheet
          householdId={householdId}
          defaultColor={colorForIndex(top.length + 1)}
          sort={top.length}
          onClose={() => setCreating(false)}
          onSaved={reload}
        />
      )}
    </main>
  )
}
