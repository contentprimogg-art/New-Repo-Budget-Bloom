import { Search, Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney } from '../lib/format'
import { IconBadge, colorForIndex } from '../lib/icons'
import { useHash } from '../lib/route'
import { childrenOf, milestonesOf, totalOf, useSavings } from '../lib/savings'
import MilestoneBar from './MilestoneBar'
import SavingsDetail from './SavingsDetail'
import ScriptTitle from './ScriptTitle'
import SearchSheet from './budget/SearchSheet'
import SavingsSheet from './savings/SavingsSheet'
import { IconButton } from './ui/PageHeader'
import BloomButton from './ui/BloomButton'
import Card from './ui/Card'
import PageShell from './ui/PageShell'
import SummaryColumns from './ui/SummaryColumns'

const PREFIX = '#/savings/'

export default function SavingsPage({ householdId }: { householdId: string }) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const hash = useHash()
  const { data, error, loaded, reload } = useSavings(householdId)
  const [creating, setCreating] = useState(false)
  const [searching, setSearching] = useState(false)

  const selectedId = hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null
  const selected = data && selectedId ? data.envelopes.find((e) => e.id === selectedId) : undefined
  if (data && selected) {
    return <SavingsDetail data={data} envelope={selected} householdId={householdId} reload={reload} />
  }

  const top = data?.envelopes.filter((e) => !e.parent_id) ?? []
  const grandTotal = data ? top.reduce((sum, e) => sum + totalOf(data, e.id), 0) : 0
  const goals = top.reduce((sum, e) => sum + (e.target ?? 0), 0)

  return (
    <PageShell
      title={t('tabSavings')}
      subtitle={data ? t('totalSavedLine', { amount: money(grandTotal) }) : undefined}
      action={
        <span className="flex items-center">
          <IconButton label={t('search')} onClick={() => setSearching(true)}>
            <Search size={21} />
          </IconButton>
          <IconButton label={t('settings')} href="#/profile">
            <Settings size={21} />
          </IconButton>
        </span>
      }
    >
      {error && (
        <div role="alert" className="rounded-2xl bg-over/10 px-4 py-3 text-sm text-over">
          <p>{/savings_/.test(error) ? t('errMigrationSavings') : t('errLoad')}</p>
          <p className="mt-1 text-xs opacity-80">{error}</p>
        </div>
      )}

      {data && (
        <>
          <ScriptTitle>{t('summaryTitle')}</ScriptTitle>
          <Card>
            <SummaryColumns
              items={[
                { label: t('savedSoFar'), value: money(grandTotal), tone: 'var(--accent-strong)' },
                { label: t('goals'), value: goals ? money(goals) : '—', tone: 'var(--chart-2)' },
                { label: t('leftShort'), value: goals ? money(Math.max(goals - grandTotal, 0)) : '—', tone: 'var(--ok)' },
              ]}
            />
          </Card>
        </>
      )}

      <ScriptTitle>{t('savingsEnvelopes')}</ScriptTitle>
      {loaded && data && top.length === 0 && <Card description={t('noSavings')} />}
      {data && top.length > 0 && (
        <Card>
          <ul className="-my-2 divide-y divide-dashed divide-muted/30">
            {top.map((e) => {
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
                      <span className="min-w-0 max-w-[48%] text-right text-[15px] font-medium tabular-nums [overflow-wrap:anywhere]">{money(total)}</span>
                    </div>
                    <MilestoneBar balance={total} target={e.target} milestones={milestonesOf(data, e.id)} format={money} />
                  </a>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      {data && (
        <BloomButton label={t('addSavings')} onClick={() => setCreating(true)} />
      )}

      {creating && (
        <SavingsSheet
          householdId={householdId}
          defaultColor={colorForIndex(top.length + 1)}
          sort={top.length}
          onClose={() => setCreating(false)}
          onSaved={reload}
        />
      )}
      {searching && (
        <SearchSheet
          householdId={householdId}
          initialKind="savings"
          onClose={() => setSearching(false)}
          onOpen={(target) => {
            setSearching(false)
            if (target.kind === 'savings') window.location.hash = `${PREFIX}${target.id}`
            else if (target.kind === 'envelope') window.location.hash = `#/envelope/${target.id}@${target.month}`
            else window.location.hash = '#/'
          }}
        />
      )}
    </PageShell>
  )
}
