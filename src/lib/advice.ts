// Moteur de conseils du compagnon: des règles appliquées aux chiffres du foyer, calculées sur
// l'appareil (aucune donnée n'est envoyée ailleurs). Chaque conseil cite les chiffres sur lesquels
// il s'appuie et propose, quand c'est possible, une action en un geste.
//
// Ton: jamais culpabilisant. On constate, on rassure (« ça arrive »), on propose; on félicite
// aussi souvent que possible ce qui va bien.

import type { Milestone, SavingsEnvelope } from './savings'
import { countsAsSpent, shiftMonth, type Envelope, type ExpenseStatus } from './types'

export interface AdviceExpense {
  id: string
  amount: number
  note: string | null
  spent_on: string
  status: ExpenseStatus
  recurring_id?: string | null
}

export type AdviceEnvelope = Envelope & { expenses: AdviceExpense[] }

export interface AdviceData {
  /** Enveloppes du mois en cours et des 6 mois précédents, avec leurs dépenses. */
  envelopes: AdviceEnvelope[]
  incomes: Record<string, number>
  starts: Record<string, number | null>
  savings: {
    pots: SavingsEnvelope[]
    own: Record<string, number>
    milestones: Milestone[]
    /** Mouvements des 90 derniers jours. */
    recent: { savings_id: string; amount: number; entry_date: string }[]
  } | null
  /** Dépenses récurrentes déjà en place: « lignée|libellé normalisé ». */
  recurringKeys: Set<string>
  /** Vrai si le foyer a déjà saisi au moins un revenu (tous mois confondus). */
  hasAnyIncome: boolean
}

export type Topic = 'pace' | 'budgets' | 'unusual' | 'subscriptions' | 'savings' | 'money' | 'wins'
export const TOPICS: Topic[] = ['pace', 'budgets', 'unusual', 'subscriptions', 'savings', 'money', 'wins']

/** win: bravo · heads: à garder à l'œil · idea: suggestion · info: simple constat. */
export type Tone = 'win' | 'heads' | 'idea' | 'info'

export type AdviceAction =
  | { kind: 'setBudget'; envelopeId: string; amount: number }
  | { kind: 'moveBudget'; fromId: string; fromBudget: number; toId: string; toBudget: number; amount: number }
  | { kind: 'makeRecurring'; envelopeId: string; expense: { id: string; note: string | null; amount: number; spent_on: string } }
  | { kind: 'open'; hash: string }

export interface Advice {
  /** Identifiant stable (sert à masquer un conseil). */
  id: string
  topic: Topic
  tone: Tone
  /** Importance: les plus élevés passent en premier. */
  weight: number
  key: string
  params: Record<string, string | number>
  envelopeId?: string
  action?: AdviceAction
  actionKey?: string
  actionParams?: Record<string, string | number>
  /** Masquer ce conseil le masque pour de bon (objectif atteint…), sinon jusqu'au mois suivant. */
  lasting?: boolean
}

interface Format {
  money: (n: number) => string
  month: (m: string) => string
  unnamed: string
}

// ——— Petits outils ———

const sum = (list: number[]) => list.reduce((s, n) => s + n, 0)
const spentOf = (e: AdviceEnvelope) => sum(e.expenses.filter((x) => countsAsSpent(x.status)).map((x) => x.amount))
const lineage = (e: Envelope) => e.lineage_id ?? `name:${e.name.trim().toLowerCase()}`
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Arrondi « rond » vers le haut: 5 en dessous de 100, 10 au-delà. */
export function niceUp(n: number) {
  const step = n < 100 ? 5 : 10
  return Math.max(step, Math.ceil(n / step) * step)
}

function median(list: number[]) {
  const s = [...list].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function daysAgo(today: Date, n: number) {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return isoDay(d)
}

const daysIn = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// ——— Le moteur ———

export function buildAdvice(data: AdviceData, today: Date, nowMonth: string, f: Format): Advice[] {
  const out: Advice[] = []
  const { money } = f
  const day = today.getDate()
  const dim = daysIn(nowMonth)
  const frac = day / dim
  const todayIso = isoDay(today)

  const byMonth = new Map<string, AdviceEnvelope[]>()
  for (const e of data.envelopes) {
    const list = byMonth.get(e.month) ?? []
    list.push(e)
    byMonth.set(e.month, list)
  }
  const current = byMonth.get(nowMonth) ?? []
  // Mois complets précédents, du plus récent au plus ancien.
  const past = [...byMonth.keys()].filter((m) => m < nowMonth).sort().reverse()
  const prev = shiftMonth(nowMonth, -1)

  /** Historique d'une enveloppe sur les mois passés (plus récent d'abord), avec budget. */
  const history = (e: Envelope) =>
    past
      .map((m) => (byMonth.get(m) ?? []).find((x) => lineage(x) === lineage(e)))
      .filter((x): x is AdviceEnvelope => !!x && x.budget > 0)

  const spentNow = new Map(current.map((e) => [e.id, spentOf(e)]))
  const paced = new Set<string>()

  // 1. Rythme et projection du mois en cours.
  for (const e of current) {
    const spent = spentNow.get(e.id) ?? 0
    if (e.budget <= 0 || spent <= 0 || spent > e.budget) continue
    if (frac < 0.2 || frac > 0.93) continue
    const ratio = spent / e.budget
    const projected = spent / frac
    if (projected > e.budget * 1.1 && ratio >= frac + 0.15) {
      const left = e.budget - spent
      const daysLeft = Math.max(dim - day, 1)
      paced.add(e.id)
      out.push({
        id: `pace:${lineage(e)}:${nowMonth}`,
        topic: 'pace',
        tone: 'heads',
        weight: 60 + Math.round((ratio - frac) * 40),
        key: 'adv_pace',
        params: { name: e.name, percent: Math.round(ratio * 100), day, left: money(left), perDay: money(Math.floor((left / daysLeft) * 100) / 100) },
        envelopeId: e.id,
      })
    }
  }

  // 2. Enveloppes dépassées ce mois-ci: d'où pourrait venir la somme, sans toucher à ce qui sera utile.
  const spare = current
    .filter((e) => e.budget > 0 && !paced.has(e.id))
    .map((e) => {
      const spent = spentNow.get(e.id) ?? 0
      // Marge « sûre »: ce qui restera vraisemblablement à la fin du mois.
      const projected = frac >= 0.85 ? spent : Math.max(spent, spent / Math.max(frac, 0.25))
      return { e, room: Math.floor(e.budget - projected) }
    })
    .filter((s) => s.room >= 5)
  const overs = current
    .map((e) => ({ e, over: (spentNow.get(e.id) ?? 0) - e.budget }))
    .filter((o) => o.over > 0.005 && o.e.budget > 0)
    .sort((a, b) => b.over - a.over)
  for (const o of overs) {
    spare.sort((a, b) => b.room - a.room)
    const source = spare[0]
    const over = Math.round(o.over * 100) / 100
    if (source) {
      const amount = Math.min(Math.ceil(over), source.room)
      source.room -= amount
      out.push({
        id: `over:${lineage(o.e)}:${nowMonth}`,
        topic: 'budgets',
        tone: 'idea',
        weight: 80,
        key: amount >= over ? 'adv_overMove' : 'adv_overMovePart',
        params: { name: o.e.name, over: money(over), from: source.e.name, amount: money(amount) },
        envelopeId: o.e.id,
        action: { kind: 'moveBudget', fromId: source.e.id, fromBudget: source.e.budget - amount, toId: o.e.id, toBudget: o.e.budget + amount, amount },
        actionKey: 'adv_doMove',
        actionParams: { amount: money(amount), from: source.e.name },
      })
      source.e = { ...source.e, budget: source.e.budget - amount }
    } else {
      out.push({
        id: `over:${lineage(o.e)}:${nowMonth}`,
        topic: 'budgets',
        tone: 'info',
        weight: 70,
        key: 'adv_overNoSpare',
        params: { name: o.e.name, over: money(over) },
        envelopeId: o.e.id,
      })
    }
  }

  // 3. Budgets à recalibrer d'après les mois passés.
  for (const e of current) {
    const h = history(e)
    if (e.budget <= 0) continue
    const recent = h.slice(0, 3)
    if (recent.length >= 2) {
      const overCount = recent.filter((x) => spentOf(x) > x.budget * 1.02).length
      if (overCount >= 2 && overCount >= recent.length - 1) {
        const target = niceUp(sum(recent.map(spentOf)) / recent.length)
        if (target > e.budget) {
          out.push({
            id: `raise:${lineage(e)}:${nowMonth}`,
            topic: 'budgets',
            tone: 'idea',
            weight: 55,
            key: 'adv_raise',
            params: { name: e.name, count: overCount, total: recent.length, budget: money(e.budget), amount: money(target) },
            envelopeId: e.id,
            action: { kind: 'setBudget', envelopeId: e.id, amount: target },
            actionKey: 'adv_doBudget',
            actionParams: { amount: money(target) },
          })
          continue
        }
      }
    }
    // Marge confortable tous les mois (et jamais de gros mois sur l'historique: pas une dépense occasionnelle).
    if (h.length >= 3 && h.every((x) => spentOf(x) <= x.budget * 0.8)) {
      const top = Math.max(...h.map(spentOf))
      const target = niceUp(top * 1.05)
      const margin = sum(h.slice(0, 3).map((x) => x.budget - spentOf(x))) / Math.min(h.length, 3)
      if (target < e.budget && e.budget - target >= 15) {
        out.push({
          id: `lower:${lineage(e)}:${nowMonth}`,
          topic: 'budgets',
          tone: 'idea',
          weight: 35,
          key: 'adv_lower',
          params: { name: e.name, margin: money(Math.round(margin)), amount: money(target), free: money(e.budget - target) },
          envelopeId: e.id,
          action: { kind: 'setBudget', envelopeId: e.id, amount: target },
          actionKey: 'adv_doBudget',
          actionParams: { amount: money(target) },
        })
      }
    }
  }

  // 4. Séries de mois tenus: on félicite.
  const streaks: Advice[] = []
  for (const e of current) {
    let n = 0
    for (const m of past) {
      const x = (byMonth.get(m) ?? []).find((y) => lineage(y) === lineage(e))
      if (!x || x.budget <= 0 || spentOf(x) <= 0 || spentOf(x) > x.budget) break
      n++
    }
    if (n >= 3) {
      streaks.push({
        id: `streak:${lineage(e)}:${nowMonth}`,
        topic: 'wins',
        tone: 'win',
        weight: 28 + n,
        key: 'adv_streak',
        params: { name: e.name, count: n },
        envelopeId: e.id,
      })
    }
  }
  out.push(...streaks.sort((a, b) => b.weight - a.weight).slice(0, 2))

  // 5. Dépenses inhabituelles (10 derniers jours), comparées aux habitudes de l'enveloppe.
  const unusual: Advice[] = []
  for (const e of current) {
    const pastAmounts = history(e)
      .slice(0, 6)
      .flatMap((x) => x.expenses.filter((y) => countsAsSpent(y.status)).map((y) => y.amount))
    if (pastAmounts.length < 5) continue
    const usual = median(pastAmounts)
    for (const x of e.expenses) {
      if (x.status !== 'active' || x.amount < 30 || x.spent_on < daysAgo(today, 10)) continue
      if (x.amount >= Math.max(usual * 2.5, usual + 30)) {
        unusual.push({
          id: `unusual:${x.id}`,
          topic: 'unusual',
          tone: 'info',
          weight: 40,
          key: 'adv_unusual',
          params: { label: x.note || f.unnamed, amount: money(x.amount), name: e.name, usual: money(Math.round(usual)) },
          envelopeId: e.id,
          lasting: true,
        })
      }
    }
  }
  out.push(...unusual.slice(0, 2))

  // 6. Abonnements: même libellé, montant proche, au moins 3 mois sur les 4 derniers.
  const recentMonths = [nowMonth, ...past.slice(0, 3)]
  const groups = new Map<string, { e: AdviceEnvelope; x: AdviceExpense }[]>()
  for (const m of recentMonths) {
    for (const e of byMonth.get(m) ?? []) {
      for (const x of e.expenses) {
        if (!x.note || normalize(x.note).length < 2 || !countsAsSpent(x.status)) continue
        const key = `${lineage(e)}|${normalize(x.note)}`
        const list = groups.get(key) ?? []
        list.push({ e, x })
        groups.set(key, list)
      }
    }
  }
  for (const [key, list] of groups) {
    const months = new Set(list.map((l) => l.e.month))
    if (months.size < 3 || data.recurringKeys.has(key) || list.some((l) => l.x.recurring_id)) continue
    const amounts = list.map((l) => l.x.amount)
    const mid = median(amounts)
    if (amounts.some((a) => Math.abs(a - mid) > mid * 0.15)) continue
    const latest = [...list].sort((a, b) => b.x.spent_on.localeCompare(a.x.spent_on))[0]
    // Proposée seulement quand l'occurrence du mois est saisie: le modèle part de celle-ci.
    if (latest.e.month !== nowMonth) continue
    out.push({
      id: `sub:${key}`,
      topic: 'subscriptions',
      tone: 'idea',
      weight: 45,
      key: 'adv_subscription',
      params: { label: latest.x.note ?? '', name: latest.e.name, amount: money(latest.x.amount), count: months.size },
      envelopeId: latest.e.id,
      action: {
        kind: 'makeRecurring',
        envelopeId: latest.e.id,
        expense: { id: latest.x.id, note: latest.x.note, amount: latest.x.amount, spent_on: latest.x.spent_on },
      },
      actionKey: 'adv_doRecurring',
    })
  }

  // 7. Épargne: objectifs, paliers, rythme.
  if (data.savings) {
    const { pots, own, milestones, recent } = data.savings
    const familyOf = (id: string) => [id, ...pots.filter((p) => p.parent_id === id).map((p) => p.id)]
    for (const pot of pots.filter((p) => !p.parent_id)) {
      const family = familyOf(pot.id)
      const total = sum(family.map((id) => own[id] ?? 0))
      const next = milestones
        .filter((m) => m.savings_id === pot.id && m.amount > total)
        .sort((a, b) => a.amount - b.amount)[0]
      if (next && total >= next.amount * 0.9) {
        out.push({
          id: `milestone:${pot.id}:${next.amount}`,
          topic: 'savings',
          tone: 'win',
          weight: 38,
          key: 'adv_milestoneClose',
          params: { name: pot.name, left: money(next.amount - total), milestone: money(next.amount) },
          action: { kind: 'open', hash: `#/savings/${pot.id}` },
          actionKey: 'adv_doOpen',
        })
      }
      if (!pot.target) continue
      if (total >= pot.target) {
        out.push({
          id: `goal-done:${pot.id}:${pot.target}`,
          topic: 'savings',
          tone: 'win',
          weight: 58,
          key: 'adv_goalReached',
          params: { name: pot.name, target: money(pot.target) },
          lasting: true,
        })
        continue
      }
      const monthly = sum(recent.filter((r) => family.includes(r.savings_id)).map((r) => r.amount)) / 3
      const left = pot.target - total
      if (monthly > 0) {
        const monthsLeft = Math.ceil(left / monthly)
        if (monthsLeft <= 120) {
          out.push({
            id: `goal-eta:${pot.id}:${nowMonth}`,
            topic: 'savings',
            tone: 'info',
            weight: 26,
            key: monthsLeft <= 1 ? 'adv_goalSoon' : 'adv_goalEta',
            params: { name: pot.name, target: money(pot.target), month: f.month(shiftMonth(nowMonth, monthsLeft)), perMonth: money(Math.round(monthly)) },
            action: { kind: 'open', hash: `#/savings/${pot.id}` },
            actionKey: 'adv_doOpen',
          })
        }
      } else {
        out.push({
          id: `goal-nudge:${pot.id}:${nowMonth}`,
          topic: 'savings',
          tone: 'idea',
          weight: 20,
          key: 'adv_goalNudge',
          params: { name: pot.name, amount: money(niceUp(left / 12)), left: money(left) },
          action: { kind: 'open', hash: `#/savings/${pot.id}` },
          actionKey: 'adv_doOpen',
        })
      }
    }
  }

  // 8. Argent du mois: non réparti, ou budgets au-delà de l'argent disponible.
  const income = data.incomes[nowMonth] ?? 0
  const start = data.starts[nowMonth] ?? null
  const budgeted = sum(current.map((e) => e.budget))
  if (current.length > 0 && (income > 0 || start != null)) {
    const free = (start ?? 0) + income - budgeted
    if (free >= 20) {
      out.push({
        id: `unallocated:${nowMonth}`,
        topic: 'money',
        tone: 'idea',
        weight: 50,
        key: 'adv_unallocated',
        params: { amount: money(Math.floor(free)) },
        action: { kind: 'open', hash: '#/savings' },
        actionKey: 'adv_doSavings',
      })
    } else if (free <= -20) {
      out.push({
        id: `overallocated:${nowMonth}`,
        topic: 'money',
        tone: 'heads',
        weight: 50,
        key: 'adv_overAllocated',
        params: { amount: money(Math.ceil(-free)) },
      })
    }
  } else if (current.length > 0 && !data.hasAnyIncome && day >= 3) {
    out.push({ id: `add-income:${nowMonth}`, topic: 'money', tone: 'idea', weight: 15, key: 'adv_addIncome', params: {} })
  }

  // 9. Début de mois: bilan du mois écoulé (toujours sous l'angle de ce qui a bien marché).
  const prevEnvs = (byMonth.get(prev) ?? []).filter((e) => e.budget > 0)
  if (day <= 10 && prevEnvs.length >= 2) {
    const kept = prevEnvs.filter((e) => spentOf(e) <= e.budget)
    const monthName = f.month(prev)
    if (kept.length === prevEnvs.length) {
      out.push({ id: `review:${prev}`, topic: 'wins', tone: 'win', weight: 56, key: 'adv_reviewAll', params: { month: monthName } })
    } else if (kept.length > 0) {
      const best = [...kept].sort((a, b) => (b.budget - spentOf(b)) / b.budget - (a.budget - spentOf(a)) / a.budget)[0]
      out.push({
        id: `review:${prev}`,
        topic: 'wins',
        tone: 'win',
        weight: 46,
        key: 'adv_review',
        params: { month: monthName, count: kept.length, total: prevEnvs.length, best: best.name },
      })
    } else {
      out.push({ id: `review:${prev}`, topic: 'wins', tone: 'info', weight: 30, key: 'adv_reviewFresh', params: { month: monthName } })
    }
    const prevIncome = data.incomes[prev] ?? 0
    if (prevIncome > 0) {
      const diff = prevIncome - sum((byMonth.get(prev) ?? []).map(spentOf))
      if (diff > 0) {
        out.push({
          id: `rate:${prev}`,
          topic: 'wins',
          tone: 'win',
          weight: 44,
          key: 'adv_saveRate',
          params: { month: monthName, rate: Math.round((diff / prevIncome) * 100), amount: money(Math.round(diff)) },
        })
      } else if (diff < -5) {
        out.push({ id: `rate:${prev}`, topic: 'money', tone: 'info', weight: 30, key: 'adv_spentMore', params: { month: monthName, amount: money(Math.round(-diff)) } })
      }
    }
  }

  // 10. Mi-parcours: tout suit le rythme.
  const budgetedNow = current.filter((e) => e.budget > 0)
  if (frac >= 0.45 && frac <= 0.93 && budgetedNow.length >= 2 && paced.size === 0 && overs.length === 0) {
    out.push({ id: `ontrack:${nowMonth}:${day >= dim * 0.75 ? 'late' : 'mid'}`, topic: 'wins', tone: 'win', weight: 40, key: 'adv_onTrack', params: { day } })
  }

  // 11. La semaine écoulée, comparée à une semaine habituelle.
  const weekStart = daysAgo(today, 6)
  const all = data.envelopes.flatMap((e) => e.expenses.filter((x) => countsAsSpent(x.status)))
  const week = sum(all.filter((x) => x.spent_on >= weekStart && x.spent_on <= todayIso).map((x) => x.amount))
  const base = past.slice(0, 3)
  if (base.length >= 2 && day >= 7) {
    const baseDays = sum(base.map(daysIn))
    const usual = (sum(base.flatMap((m) => (byMonth.get(m) ?? []).map(spentOf))) / baseDays) * 7
    if (usual > 0 && week < usual * 0.75) {
      out.push({ id: `week:${weekStart}`, topic: 'wins', tone: 'win', weight: 24, key: 'adv_weekCalm', params: { amount: money(Math.round(week)), usual: money(Math.round(usual)) } })
    } else if (usual > 0 && week > usual * 1.4 && week - usual >= 30) {
      out.push({ id: `week:${weekStart}`, topic: 'pace', tone: 'info', weight: 30, key: 'adv_weekBusy', params: { amount: money(Math.round(week)), usual: money(Math.round(usual)) } })
    }
  }

  // 12. Rien noté depuis un moment: un rappel tout en douceur.
  const lastSpent = all.map((x) => x.spent_on).filter((d) => d <= todayIso).sort().pop()
  if (current.length > 0 && day >= 8 && (!lastSpent || lastSpent < daysAgo(today, 7))) {
    const since = lastSpent ? Math.round((today.getTime() - new Date(`${lastSpent}T12:00:00`).getTime()) / 86_400_000) : null
    out.push({
      id: `quiet:${nowMonth}:${Math.floor(day / 7)}`,
      topic: 'pace',
      tone: 'info',
      weight: 22,
      key: since ? 'adv_quiet' : 'adv_quietNone',
      params: { days: since ?? 0 },
    })
  }

  return out.sort((a, b) => b.weight - a.weight)
}
