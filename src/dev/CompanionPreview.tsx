import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Companion from '../components/Companion'
import ScriptTitle from '../components/ScriptTitle'
import { buildAdvice, type Advice, type AdviceData, type AdviceEnvelope } from '../lib/advice'
import { fmtMoney, fmtMonth } from '../lib/format'
import { shiftMonth } from '../lib/types'

// Aperçu du compagnon avec un foyer fictif (7 mois d'historique), pour vérifier règles et textes.
const NOW = '2026-10'
const TODAY = new Date(2026, 9, 6, 10)

function env(month: string, lineage: string, name: string, budget: number, amounts: number[], notes: string[] = []): AdviceEnvelope {
  return {
    id: `${lineage}-${month}`,
    household_id: 'h',
    month,
    name,
    kind: 'spending',
    parent_id: null,
    budget,
    color: null,
    icon: null,
    sort: 0,
    recurring: true,
    lineage_id: lineage,
    expenses: amounts.map((amount, i) => ({
      id: `${lineage}-${month}-${i}`,
      amount,
      note: notes[i] ?? null,
      spent_on: `${month}-${String(Math.min(2 + i * 3, 28)).padStart(2, '0')}`,
      status: 'active',
    })),
  }
}

function fakeData(): AdviceData {
  const envelopes: AdviceEnvelope[] = []
  for (let i = 6; i >= 1; i--) {
    const m = shiftMonth(NOW, -i)
    envelopes.push(env(m, 'courses', 'Courses', 400, [80, 95, 70, 90, 60]))
    envelopes.push(env(m, 'essence', 'Essence', 100, i <= 3 ? [70, 65] : [50, 40]))
    envelopes.push(env(m, 'loyer', 'Loyer', 800, [720]))
    envelopes.push(env(m, 'loisirs', 'Loisirs', 150, [12.99, 40, 30], ['Netflix', 'Cinéma', 'Resto']))
  }
  envelopes.push(env(NOW, 'courses', 'Courses', 400, [85, 260], ['Carrefour', 'Darty']))
  envelopes.push(env(NOW, 'essence', 'Essence', 100, [70, 55]))
  envelopes.push(env(NOW, 'loyer', 'Loyer', 800, [720]))
  envelopes.push(env(NOW, 'loisirs', 'Loisirs', 150, [12.99], ['Netflix']))
  return {
    envelopes,
    incomes: { [NOW]: 2350, [shiftMonth(NOW, -1)]: 2350 },
    starts: { [NOW]: 120 },
    savings: {
      pots: [
        { id: 'p1', household_id: 'h', parent_id: null, name: 'Vacances', target: 2000, sort: 0 },
        { id: 'p2', household_id: 'h', parent_id: null, name: 'Coussin de sécurité', target: 3000, sort: 1 },
      ],
      own: { p1: 920, p2: 1400 },
      milestones: [{ id: 'm1', savings_id: 'p1', amount: 1000 }],
      recent: [
        { savings_id: 'p1', amount: 150, entry_date: '2026-08-05' },
        { savings_id: 'p1', amount: 150, entry_date: '2026-09-05' },
        { savings_id: 'p1', amount: 150, entry_date: '2026-10-05' },
      ],
    },
    recurringKeys: new Set(),
    hasAnyIncome: true,
  }
}

export default function CompanionPreview() {
  const { i18n } = useTranslation()
  const lng = i18n.language
  const [hidden, setHidden] = useState<string[]>([])
  const all = useMemo(
    () => buildAdvice(fakeData(), TODAY, NOW, { money: (n) => fmtMoney(n, lng), month: (m) => fmtMonth(m, lng), unnamed: 'Sans nom' }),
    [lng],
  )
  const advice = all.filter((a) => !hidden.includes(a.id))
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-8">
      <ScriptTitle>Le mot de Bloom</ScriptTitle>
      <Companion
        advice={advice}
        hide={(a: Advice) => setHidden((h) => [...h, a.id])}
        apply={async () => null}
      />
    </main>
  )
}
