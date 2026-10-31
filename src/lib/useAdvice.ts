import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildAdvice, TOPICS, type Advice, type AdviceAction, type AdviceData, type AdviceEnvelope, type Topic } from './advice'
import { fmtMoney, fmtMonth } from './format'
import { useDataVersion } from './realtime'
import { makeRecurring } from './recurring'
import { loadSavings } from './savings'
import { supabase } from './supabase'
import { currentMonth, shiftMonth } from './types'

// ——— Préférences du compagnon (sur cet appareil) ———

const SETTINGS_KEY = 'bloomCompanion'
const HIDDEN_KEY = 'bloomAdviceHidden'

export interface CompanionSettings {
  enabled: boolean
  off: Topic[]
}

export function readCompanion(): CompanionSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<CompanionSettings>
    return { enabled: raw.enabled !== false, off: (raw.off ?? []).filter((t): t is Topic => TOPICS.includes(t)) }
  } catch {
    return { enabled: true, off: [] }
  }
}

export function writeCompanion(settings: CompanionSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event('bloom-companion'))
}

/** Conseils masqués: identifiant → mois où il a été masqué, ou « * » pour toujours. */
function readHidden(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

/** Réaffiche tous les conseils masqués. */
export function resetHidden() {
  writeHidden({})
  window.dispatchEvent(new Event('bloom-companion'))
}

function writeHidden(hidden: Record<string, string>) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden))
  } catch {
    /* stockage indisponible */
  }
}

export function useCompanionSettings() {
  const [settings, setSettings] = useState(readCompanion)
  useEffect(() => {
    const on = () => setSettings(readCompanion())
    window.addEventListener('bloom-companion', on)
    return () => window.removeEventListener('bloom-companion', on)
  }, [])
  return settings
}

// ——— Données ———

async function loadAdviceData(householdId: string, nowMonth: string): Promise<AdviceData | null> {
  const months = Array.from({ length: 7 }, (_, i) => shiftMonth(nowMonth, -i))
  const envQuery = (fields: string) =>
    // Sélection construite: typée comme « * » (le détail est converti plus bas).
    supabase.from('envelopes').select(`*, expenses(${fields})` as '*').eq('household_id', householdId).in('month', months)
  let env = await envQuery('id, amount, note, spent_on, status, recurring_id')
  // Base sans la migration 0008 (pas de dépenses récurrentes): même chose sans la colonne.
  if (env.error) env = await envQuery('id, amount, note, spent_on, status')
  if (env.error) return null

  const since = new Date()
  since.setDate(since.getDate() - 90)
  const [inc, bal, rec, anyIncome, entries, savings] = await Promise.all([
    supabase.from('incomes').select('month, amount').eq('household_id', householdId).in('month', months),
    supabase.from('month_balances').select('month, start_balance').eq('household_id', householdId).in('month', months),
    supabase.from('recurring_expenses').select('lineage_id, note').eq('household_id', householdId),
    supabase.from('incomes').select('id').eq('household_id', householdId).limit(1),
    supabase.from('savings_entries').select('savings_id, amount, entry_date').eq('household_id', householdId).gte('entry_date', since.toISOString().slice(0, 10)),
    loadSavings(householdId),
  ])

  const incomes: Record<string, number> = {}
  for (const i of inc.data ?? []) incomes[i.month] = (incomes[i.month] ?? 0) + Number(i.amount)
  const starts: Record<string, number | null> = {}
  for (const b of bal.data ?? []) starts[b.month] = b.start_balance == null ? null : Number(b.start_balance)

  return {
    envelopes: (env.data ?? []).map((e) => ({
      ...e,
      budget: Number(e.budget),
      expenses: ((e.expenses ?? []) as AdviceEnvelope['expenses']).map((x) => ({ ...x, amount: Number(x.amount) })),
    })) as AdviceEnvelope[],
    incomes,
    starts,
    savings: savings.data
      ? {
          pots: savings.data.envelopes,
          own: savings.data.own,
          milestones: savings.data.milestones,
          recent: (entries.data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })),
        }
      : null,
    recurringKeys: new Set((rec.data ?? []).map((r) => `${r.lineage_id}|${(r.note ?? '').trim().toLowerCase().replace(/\s+/g, ' ')}`)),
    hasAnyIncome: (anyIncome.data ?? []).length > 0,
  }
}

// ——— Le compagnon ———

export function useAdvice(householdId: string) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const version = useDataVersion()
  const settings = useCompanionSettings()
  const nowMonth = currentMonth()
  const [data, setData] = useState<AdviceData | null>(null)
  const [hidden, setHidden] = useState(readHidden)
  useEffect(() => {
    const on = () => setHidden(readHidden())
    window.addEventListener('bloom-companion', on)
    return () => window.removeEventListener('bloom-companion', on)
  }, [])

  const reload = useCallback(async () => {
    const result = await loadAdviceData(householdId, nowMonth)
    if (result) setData(result)
  }, [householdId, nowMonth])

  useEffect(() => {
    if (!settings.enabled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload, version, settings.enabled])

  const all = useMemo<Advice[]>(() => {
    if (!data) return []
    return buildAdvice(data, new Date(), nowMonth, {
      money: (n) => fmtMoney(n, lng),
      month: (m) => fmtMonth(m, lng),
      unnamed: t('unnamed'),
    })
  }, [data, nowMonth, lng, t])

  const advice = useMemo(
    () =>
      settings.enabled
        ? all.filter((a) => !settings.off.includes(a.topic) && hidden[a.id] !== '*' && hidden[a.id] !== nowMonth)
        : [],
    [all, settings, hidden, nowMonth],
  )

  const hide = useCallback(
    (a: Advice) => {
      // On profite de l'écriture pour oublier les conseils masqués des mois passés.
      const next = Object.fromEntries(Object.entries(readHidden()).filter(([, v]) => v === '*' || v >= shiftMonth(nowMonth, -1)))
      next[a.id] = a.lasting ? '*' : nowMonth
      writeHidden(next)
      setHidden(next)
    },
    [nowMonth],
  )

  /** Applique l'action d'un conseil; renvoie un message d'erreur ou null. */
  const apply = useCallback(
    async (action: AdviceAction): Promise<string | null> => {
      if (action.kind === 'open') {
        window.location.hash = action.hash
        return null
      }
      if (!navigator.onLine) return t('needsNetwork')
      if (action.kind === 'setBudget') {
        const { error } = await supabase.from('envelopes').update({ budget: action.amount }).eq('id', action.envelopeId)
        if (error) return error.message
      } else if (action.kind === 'moveBudget') {
        const a = await supabase.from('envelopes').update({ budget: action.fromBudget }).eq('id', action.fromId)
        if (a.error) return a.error.message
        const b = await supabase.from('envelopes').update({ budget: action.toBudget }).eq('id', action.toId)
        if (b.error) return b.error.message
      } else if (action.kind === 'makeRecurring') {
        const envelope = data?.envelopes.find((e) => e.id === action.envelopeId)
        if (!envelope) return t('errGeneric')
        const r = await makeRecurring({ envelope, expense: action.expense, every: 1 })
        if (r.error) return /recurring_expenses/.test(r.error) ? t('errMigration0008') : r.error
      }
      await reload()
      return null
    },
    [data, reload, t],
  )

  return { advice, enabled: settings.enabled, loaded: !!data || !settings.enabled, hide, apply }
}
