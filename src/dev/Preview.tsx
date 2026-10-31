import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EnvelopeRow from '../components/budget/EnvelopeRow'
import GroupSection from '../components/budget/GroupSection'
import QuickAddSheet from '../components/budget/QuickAddSheet'
import { TransactionRow } from '../components/EnvelopeDetail'
import IconPicker from '../components/IconPicker'
import MilestoneBar from '../components/MilestoneBar'
import ScriptTitle from '../components/ScriptTitle'
import { BottomNav } from '../components/TabBar'
import Tips from '../components/Tips'
import Avatar from '../components/Avatar'
import Fab from '../components/ui/Fab'
import HatchedDonut from '../components/ui/HatchedDonut'
import PageHeader, { IconButton } from '../components/ui/PageHeader'
import StripeBar from '../components/ui/StripeBar'
import SummaryColumns from '../components/ui/SummaryColumns'
import { fmtMoney } from '../lib/format'
import { IconBadge, badgeColor } from '../lib/icons'
import type { Envelope, Expense } from '../lib/types'

// Aperçu des composants avec des données fictives (développement uniquement, aucune requête).
const base = { household_id: 'h', month: '2026-10', kind: 'spending' as const, parent_id: null, sort: 0, recurring: true }
const ENVS: Envelope[] = [
  { ...base, id: '1', name: 'Courses', budget: 500, color: '#E8749E', icon: 'cart', group_id: 'g1' },
  { ...base, id: '2', name: 'Sorties', budget: 100, color: '#3FA37A', icon: 'wine', group_id: 'g1' },
  { ...base, id: '3', name: 'Essence', budget: 150, color: '#4F8FDB', icon: 'fuel', group_id: 'g1' },
  { ...base, id: '4', name: 'Loyer', budget: 900, color: '#A07FE0', icon: 'home', group_id: null },
  { ...base, id: '5', name: 'Multimédia', budget: 200, color: '#E58C3E', icon: 'game', group_id: null, recurring: false },
]
const SPENT: Record<string, number> = { '1': 378.42, '2': 117, '3': 96.5, '4': 900, '5': 45 }
const EXPENSES: Expense[] = [
  { id: 'a', envelope_id: '1', amount: 62.3, note: 'Carrefour', spent_on: '2026-10-28', status: 'active', settled_on: null },
  { id: 'b', envelope_id: '1', amount: 75, note: 'Souris gaming pour Léa', spent_on: '2026-10-21', status: 'refunded', settled_on: '2026-10-25' },
  { id: 'c', envelope_id: '1', amount: 18.9, note: null, spent_on: '2026-10-14', status: 'active', settled_on: null },
]

export default function Preview() {
  const { i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const [quick, setQuick] = useState(window.location.hash.includes('quick'))
  const picker = window.location.hash.includes('picker')
  const totalBudget = ENVS.reduce((s, e) => s + e.budget, 0)
  const totalSpent = ENVS.reduce((s, e) => s + SPENT[e.id], 0)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 pb-36 pt-5">
      <PageHeader
        left={<img src="/favicon.svg" alt="" className="size-9 rounded-xl" />}
        center={
          <>
            <IconButton label="prev">
              <ChevronLeft size={18} />
            </IconButton>
            <h1 className="truncate px-1">octobre 2026</h1>
            <IconButton label="next">
              <ChevronRight size={18} />
            </IconButton>
          </>
        }
        right={<Avatar />}
      />

      <ScriptTitle>Résumé</ScriptTitle>
      <SummaryColumns
        items={[
          { label: 'Solde', value: money(2480), tone: 'var(--chart-2)' },
          { label: 'Budgété', value: money(totalBudget), tone: 'var(--ok)' },
          { label: 'Dépensé', value: money(totalSpent), tone: 'var(--accent-strong)' },
        ]}
      />
      <StripeBar spent={totalSpent} budget={totalBudget} label="total" />
      <p className="text-center text-sm">
        <span className="font-semibold text-ok-ink">{money(totalBudget - totalSpent)}</span> restants sur{' '}
        <span className="font-semibold">{money(totalBudget)}</span>
      </p>
      <Tips tips={[{ key: 'tipHomeRealloc', params: { name: 'Sorties', amount: money(17), from: 'Multimédia' } }]} title="Pistes pour limiter le dépassement" />

      <ScriptTitle>Enveloppes</ScriptTitle>
      <GroupSection id="g1" title="Dépenses variables" envelopes={ENVS.slice(0, 3)} spentBy={SPENT} onOpen={() => {}} onRename={() => {}} onDelete={() => {}} />
      <GroupSection id="none" title="Sans groupe" envelopes={ENVS.slice(3)} spentBy={SPENT} onOpen={() => {}} />
      <ul className="divide-y divide-dashed divide-muted/30">
        <EnvelopeRow envelope={ENVS[0]} spent={SPENT['1']} onOpen={() => {}} />
      </ul>

      <ScriptTitle>Répartition</ScriptTitle>
      <HatchedDonut
        size={300}
        gapColor="var(--paper)"
        ariaLabel="répartition"
        format={money}
        slices={ENVS.map((e) => ({ key: e.id, label: e.name, value: SPENT[e.id], color: badgeColor(e.color), icon: e.icon }))}
        center={
          <>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Dépensé</span>
            <span className="text-xl font-medium tabular-nums">{money(totalSpent)}</span>
          </>
        }
      />

      <ScriptTitle>Détail</ScriptTitle>
      <div className="flex flex-col items-center gap-2">
        <IconBadge icon="cart" color="#E8749E" size="lg" />
        <p className="text-2xl font-medium">Courses</p>
      </div>
      <HatchedDonut
        size={240}
        labels={false}
        gapColor="var(--paper)"
        ariaLabel="courses"
        format={money}
        slices={[
          { key: 's', label: 'Dépensé', value: 378.42, color: '#E8749E' },
          { key: 'l', label: 'Restant', value: 121.58, color: 'var(--ok)' },
        ]}
        center={
          <>
            <span className="text-3xl font-medium">76%</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">utilisé</span>
          </>
        }
      />
      <ScriptTitle>Transactions</ScriptTitle>
      <ul className="divide-y divide-dashed divide-muted/30">
        {EXPENSES.map((e) => (
          <TransactionRow key={e.id} householdId="h" expense={e} view="list" onChanged={() => {}} />
        ))}
      </ul>

      <ScriptTitle>Épargne</ScriptTitle>
      <MilestoneBar balance={1240} target={3000} milestones={[500, 1000]} format={money} />

      {picker && <IconPicker icon="cart" color="#E8749E" onChange={() => {}} />}

      <Fab label="Nouvelle dépense" onClick={() => setQuick(true)} />
      <BottomNav />
      {quick && <QuickAddSheet envelopes={ENVS} onClose={() => setQuick(false)} onAdded={() => {}} />}
    </main>
  )
}
