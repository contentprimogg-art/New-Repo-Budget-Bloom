import SearchSheet from '../components/budget/SearchSheet'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EnvelopeRow from '../components/budget/EnvelopeRow'
import IncomeList from '../components/budget/IncomeList'
import GroupSection from '../components/budget/GroupSection'
import QuickAddSheet from '../components/budget/QuickAddSheet'
import { TransactionRow } from '../components/EnvelopeDetail'
import IconPicker from '../components/IconPicker'
import LanguageSwitch from '../components/LanguageSwitch'
import MilestoneBar from '../components/MilestoneBar'
import ScriptTitle from '../components/ScriptTitle'
import Tips from '../components/Tips'
import AvatarStack from '../components/ui/AvatarStack'
import BloomButton from '../components/ui/BloomButton'
import Card from '../components/ui/Card'
import ColorSheet from '../components/ui/ColorSheet'
import Fab from '../components/ui/Fab'
import Donut from '../components/ui/Donut'
import PageShell from '../components/ui/PageShell'
import Sheet from '../components/ui/Sheet'
import Splash from '../components/ui/Splash'
import ProgressBar from '../components/ui/ProgressBar'
import SummaryColumns from '../components/ui/SummaryColumns'
import { fmtMoney } from '../lib/format'
import { chartColor } from '../lib/color'
import { badgeColor } from '../lib/icons'
import type { Member } from '../lib/household'
import type { Envelope, Expense, Income } from '../lib/types'

// Aperçu des composants avec des données fictives (développement uniquement, aucune requête).
// Variantes: #/__preview, #/__preview-quick, #/__preview-picker, #/__preview-color, #/__preview-splash, #/__preview-search
const base = { household_id: 'h', month: '2026-10', kind: 'spending' as const, parent_id: null, sort: 0, recurring: true }
const ENVS: Envelope[] = [
  { ...base, id: '1', name: 'Courses', budget: 500, color: '#E8749E', icon: 'cart', group_id: 'g1' },
  { ...base, id: '2', name: 'Sorties', budget: 100, color: '#E2F3E6', icon: '🍷', group_id: 'g1' },
  { ...base, id: '3', name: 'Essence', budget: 150, color: '#4F8FDB', icon: 'fuel', group_id: 'g1' },
  { ...base, id: '4', name: 'Loyer', budget: 900, color: '#A07FE0', icon: 'home', group_id: null },
  { ...base, id: '5', name: 'Cadeaux de Noël', budget: 200, color: '#FDE6D6', icon: '🧸', group_id: null, recurring: false },
]
const INCOMES: Income[] = [
  { id: 'i1', household_id: 'h', month: '2026-10', label: 'Salaire', amount: 2350, received_on: '2026-10-01', recurring: true, icon: '💼', color: '#E3E8FB' },
  { id: 'i2', household_id: 'h', month: '2026-10', label: 'Vente Vinted', amount: 42, received_on: '2026-10-18', recurring: false, icon: '🛍️', color: '#FBE3EC' },
]
const MEMBERS: Member[] = [
  { id: 'a', name: 'Primo', avatarUrl: null, isMe: true },
  { id: 'b', name: 'Boomette', avatarUrl: '/apple-touch-icon.png', isMe: false },
  { id: 'c', name: 'Léa', avatarUrl: null, isMe: false },
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
  const hash = window.location.hash
  const [quick, setQuick] = useState(hash.includes('quick'))
  const [look, setLook] = useState<{ icon: string | null; color: string | null }>({ icon: '🛒', color: '#FBE3EC' })
  const totalBudget = ENVS.reduce((s, e) => s + e.budget, 0)
  const totalSpent = ENVS.reduce((s, e) => s + SPENT[e.id], 0)

  if (hash.includes('splash')) return <Splash />

  return (
    <PageShell
      wide
      title="Budget"
      fab={<Fab label="Nouvelle dépense" onClick={() => setQuick(true)} />}
      subtitle={
        <div className="mt-2 inline-flex items-center rounded-full border border-border bg-surface py-0.5 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-text">
          <span className="grid size-8 place-items-center">
            <ChevronLeft size={16} />
          </span>
          <span className="px-1">octobre 2026</span>
          <span className="grid size-8 place-items-center">
            <ChevronRight size={16} />
          </span>
        </div>
      }
    >
      <ScriptTitle>Résumé</ScriptTitle>
      <Card>
        <div className="flex flex-col gap-4">
          <SummaryColumns
            items={[
              { label: 'Solde', value: money(2480), tone: 'var(--chart-2)' },
              { label: 'Budgété', value: money(totalBudget), tone: 'var(--ok)' },
              { label: 'Dépensé', value: money(totalSpent), tone: 'var(--accent-strong)' },
            ]}
          />
          <ProgressBar spent={totalSpent} budget={totalBudget} label="total" />
          <p className="text-center text-sm">
            <span className="font-semibold text-ok-ink">{money(totalBudget - totalSpent)}</span> restants sur{' '}
            <span className="font-semibold">{money(totalBudget)}</span>
          </p>
        </div>
      </Card>
      <Tips tips={[{ key: 'tipHomeRealloc', params: { name: 'Sorties', amount: money(17), from: 'Cadeaux de Noël' } }]} title="Pistes pour limiter le dépassement" />

      <ScriptTitle>Revenus</ScriptTitle>
      <IncomeList incomes={INCOMES} onEdit={() => {}} />

      <Card title="Qui a ajouté" description="Photos qui se chevauchent, découpées en croissant">
        <div className="flex items-center gap-6">
          <AvatarStack members={MEMBERS.slice(0, 2)} size={36} />
          <AvatarStack members={MEMBERS} size={28} />
          <AvatarStack members={[...MEMBERS, ...MEMBERS.map((m) => ({ ...m, id: m.id + '2' }))]} size={22} />
        </div>
      </Card>

      <ScriptTitle>Enveloppes</ScriptTitle>
      <Card>
        <GroupSection id="g1" title="Dépenses variables" envelopes={ENVS.slice(0, 3)} spentBy={SPENT} onOpen={() => {}} onRename={() => {}} onDelete={() => {}} />
      </Card>
      <Card>
        <ul className="-my-2 divide-y divide-dashed divide-muted/30">
          {ENVS.slice(3).map((e) => (
            <EnvelopeRow key={e.id} envelope={e} spent={SPENT[e.id]} onOpen={() => {}} />
          ))}
        </ul>
      </Card>

      <BloomButton label="Nouvelle enveloppe" onClick={() => {}} />

      <ScriptTitle>Répartition</ScriptTitle>
      <Donut
        size={300}
        gapColor="var(--paper)"
        ariaLabel="répartition"
        format={money}
        slices={ENVS.map((e) => ({ key: e.id, label: e.name, value: SPENT[e.id], color: chartColor(badgeColor(e.color)), icon: e.icon }))}
        center={<span className="text-xl font-medium tabular-nums">{money(totalSpent)}</span>}
      />

      <ScriptTitle>Transactions</ScriptTitle>
      <Card>
        <ul className="-my-2 divide-y divide-dashed divide-muted/30">
          {EXPENSES.map((e) => (
            <TransactionRow key={e.id} householdId="h" expense={e} view="list" onChanged={() => {}} />
          ))}
        </ul>
      </Card>

      <Card title="Épargne vacances" description="Objectif 3 000 €">
        <MilestoneBar balance={1240} target={3000} milestones={[500, 1000]} format={money} />
      </Card>
      <Card title="Langue" description="Choisissez la langue de l'application." action={<LanguageSwitch full />} />

      {quick && <QuickAddSheet envelopes={ENVS} onClose={() => setQuick(false)} onAdded={() => {}} />}
      {hash.includes('picker') && (
        <Sheet title="Icône" onClose={() => {}}>
          <IconPicker icon={look.icon} color={look.color} onChange={setLook} />
        </Sheet>
      )}
      {hash.includes('search') && <SearchSheet householdId="preview" onClose={() => {}} onOpen={() => {}} />}
      {hash.includes('color') && <ColorSheet title="Couleur libre" value="#C2185B" onClose={() => {}} onPick={() => {}} />}
    </PageShell>
  )
}
