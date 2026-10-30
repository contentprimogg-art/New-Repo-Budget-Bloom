import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney, parseAmount } from '../lib/format'
import { useHash } from '../lib/route'
import { reallocTips } from '../lib/tips'
import { supabase } from '../lib/supabase'
import { countsAsSpent, currentMonth, envelopeStats, shiftMonth, type Envelope, type Profile } from '../lib/types'
import EnvelopeDetail from './EnvelopeDetail'
import EnvelopeStrip from './EnvelopeStrip'
import LanguageSwitch from './LanguageSwitch'
import IconPicker from './IconPicker'
import MonthSummary from './MonthSummary'
import ProfileForm from './ProfileForm'
import ScriptTitle from './ScriptTitle'
import TabBar from './TabBar'
import Tips from './Tips'

const PREFIX = '#/envelope/'

// Navigation par hash: le bouton « retour » du téléphone ferme le détail.
function useSelectedId() {
  const hash = useHash()
  return hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null
}

export default function Home({ householdId, profile }: { householdId: string; profile: Profile }) {
  const { t, i18n } = useTranslation()
  const nowMonth = currentMonth()
  const [month, setMonth] = useState(nowMonth)
  const [firstMonth, setFirstMonth] = useState<string | null>(null)
  const [rolled, setRolled] = useState(0)
  const selectedId = useSelectedId()
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [spentBy, setSpentBy] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const rolledOver = useRef(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    if (!rolledOver.current) {
      rolledOver.current = true
      // Reconduit les enveloppes récurrentes au premier chargement du mois en cours (sans effet ensuite).
      const { data, error } = await supabase.rpc('rollover_month', { h: householdId, m: nowMonth })
      if (error) console.warn('rollover_month:', error.message)
      else if (typeof data === 'number' && data > 0) setRolled(data)
    }
    const first = await supabase
      .from('envelopes')
      .select('month')
      .eq('household_id', householdId)
      .order('month')
      .limit(1)
      .maybeSingle()
    if (first.data) setFirstMonth(first.data.month)
    const env = await supabase
      .from('envelopes')
      .select('*')
      .eq('household_id', householdId)
      .eq('month', month)
      .order('sort')
      .order('created_at')
    if (env.error) {
      setLoadError(env.error.message)
      setLoaded(true)
      return
    }
    const list = (env.data ?? []) as Envelope[]
    const sums: Record<string, number> = {}
    if (list.length) {
      const exp = await supabase
        .from('expenses')
        .select('envelope_id, amount, status')
        .in('envelope_id', list.map((e) => e.id))
      if (exp.error) {
        setLoadError(exp.error.message)
        setLoaded(true)
        return
      }
      for (const e of exp.data ?? []) {
        if (countsAsSpent(e.status)) sums[e.envelope_id] = (sums[e.envelope_id] ?? 0) + Number(e.amount)
      }
    }
    if (id !== requestId.current) return // une requête plus récente (autre mois) a pris le relais
    setLoadError(null)
    setEnvelopes(list)
    setSpentBy(sums)
    setLoaded(true)
  }, [householdId, month, nowMonth])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const selected = selectedId ? envelopes.find((e) => e.id === selectedId) : undefined
  if (selected) {
    return (
      <EnvelopeDetail
        envelope={selected}
        siblings={envelopes
          .filter((e) => e.id !== selected.id)
          .map((e) => ({ name: e.name, remaining: e.budget - (spentBy[e.id] ?? 0) }))}
        onChanged={load}
        onClose={() => {
          window.location.hash = ''
        }}
      />
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl md:px-6 xl:max-w-6xl">
      {profile.firstName && <p className="font-script text-4xl leading-tight">{t('hello', { name: profile.firstName })}</p>}
      <div className="flex items-center justify-between gap-3">
        <TabBar />
        <button onClick={() => supabase.auth.signOut()} className="no-print text-sm text-muted underline">
          {t('signOut')}
        </button>
      </div>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={!firstMonth || month <= firstMonth}
            aria-label={t('prevMonth')}
            className="no-print rounded-full p-2 text-lg leading-none text-accent-strong hover:bg-accent-soft"
          >
            ‹
          </button>
          <h1 className="min-w-36 text-center text-xl font-semibold capitalize">
            {new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
              new Date(`${month}-01T12:00:00`),
            )}
          </h1>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= nowMonth}
            aria-label={t('nextMonth')}
            className="no-print rounded-full p-2 text-lg leading-none text-accent-strong hover:bg-accent-soft"
          >
            ›
          </button>
          {month !== nowMonth && (
            <button onClick={() => setMonth(nowMonth)} className="no-print ml-1 text-sm text-accent-strong underline">
              {t('currentMonth')}
            </button>
          )}
        </div>
      </header>
      {rolled > 0 && month === nowMonth && (
        <p className="no-print flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm">
          <span>{t('rolledOver', { count: rolled })}</span>
          <button onClick={() => setRolled(0)} aria-label={t('close')} className="text-muted">
            ✕
          </button>
        </p>
      )}
      {loadError && (
        <div role="alert" className="rounded-xl bg-over/10 px-4 py-3 text-sm text-over">
          <p>{t('errLoad')}</p>
          <p className="mt-1 text-xs opacity-80">{loadError}</p>
        </div>
      )}
      {loaded && !loadError && <ScriptTitle>{t('summaryTitle')}</ScriptTitle>}
      {loaded && !loadError && (
        <MonthSummary
          key={month}
          householdId={householdId}
          month={month}
          totalBudget={envelopes.reduce((sum, e) => sum + e.budget, 0)}
          totalSpent={envelopes.reduce((sum, e) => sum + (spentBy[e.id] ?? 0), 0)}
          totalOver={envelopes.reduce((sum, e) => sum + Math.max(0, (spentBy[e.id] ?? 0) - e.budget), 0)}
        />
      )}
      {loaded && !loadError && (
        <Tips
          title={t('tipsOverTitle')}
          tips={reallocTips(
            envelopes.map((e) => ({ name: e.name, budget: e.budget, spent: spentBy[e.id] ?? 0 })),
            (n) => fmtMoney(n, i18n.language),
          )}
        />
      )}
      {loaded && !loadError && envelopes.length === 0 && (
        <p className="text-muted">{month === nowMonth ? t('noEnvelopes') : t('noEnvelopesPast')}</p>
      )}
      <ScriptTitle>{t('envelopes')}</ScriptTitle>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {envelopes.map((e) => (
          <EnvelopeStrip
            key={e.id}
            envelope={e}
            stats={envelopeStats(e.budget, spentBy[e.id] ?? 0)}
            onChange={load}
          />
        ))}
        <NewEnvelope householdId={householdId} month={month} sort={envelopes.length} onAdded={load} />
      </div>
      <InviteCode householdId={householdId} />
      <ProfileForm profile={profile} />
      <LanguageSwitch />
    </main>
  )
}

function InviteCode({ householdId }: { householdId: string }) {
  const { t } = useTranslation()
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void supabase
      .from('households')
      .select('invite_code')
      .eq('id', householdId)
      .maybeSingle()
      .then(({ data }) => setCode(data?.invite_code ?? null))
  }, [householdId])

  if (!code) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(code!)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* presse-papiers indisponible (HTTP): le code reste affiché pour le recopier à la main */
    }
  }

  return (
    <section className="no-print flex flex-col gap-1 rounded-2xl bg-accent-soft p-4 text-sm">
      <p className="font-medium">{t('inviteTitle')}</p>
      <p className="text-muted">{t('inviteHint')}</p>
      <div className="mt-1 flex items-center gap-3">
        <code className="rounded-lg bg-surface px-3 py-1.5 text-base font-semibold tracking-widest">{code}</code>
        <button onClick={() => void copy()} className="text-accent-strong underline">
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </section>
  )
}

function NewEnvelope({
  householdId,
  month,
  sort,
  onAdded,
}: {
  householdId: string
  month: string
  sort: number
  onAdded: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  const [recurring, setRecurring] = useState(true)
  const [look, setLook] = useState<{ icon: string | null; color: string | null }>({ icon: null, color: null })
  const [errors, setErrors] = useState<{ name?: string; budget?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const value = parseAmount(budget)
    const found: typeof errors = {}
    if (!name.trim()) found.name = t('errNameRequired')
    if (!(value >= 0) || budget.trim() === '') found.budget = t('errAmount')
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    const { error } = await supabase
      .from('envelopes')
      .insert({ household_id: householdId, month, name: name.trim(), budget: value, sort, recurring, ...look })
    setBusy(false)
    if (error) return setErrors({ form: `${t('errSave')} (${error.message})` })
    setName('')
    setBudget('')
    setLook({ icon: null, color: null })
    onAdded()
  }

  return (
    <form
      onSubmit={add}
      noValidate
      className="no-print flex flex-col gap-2 rounded-2xl border border-dashed border-accent p-4"
    >
      <div>
        <input
          placeholder={t('envelopeName')}
          aria-label={t('envelopeName')}
          aria-invalid={!!errors.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2"
        />
        {errors.name && <p className="mt-1 px-1 text-sm text-over">{errors.name}</p>}
      </div>
      <div>
        <input
          inputMode="decimal"
          placeholder={t('envelopeBudget')}
          aria-label={t('envelopeBudget')}
          aria-invalid={!!errors.budget}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2"
        />
        {errors.budget && <p className="mt-1 px-1 text-sm text-over">{errors.budget}</p>}
      </div>
      <IconPicker icon={look.icon} color={look.color} onChange={setLook} />
      <label className="flex items-center gap-2 px-1 text-sm text-muted">
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        {t('recurringLabel')}
      </label>
      {errors.form && <p className="px-1 text-sm text-over">{errors.form}</p>}
      <button disabled={busy} className="rounded-full bg-accent-strong px-4 py-2 font-medium text-white">
        {t('addEnvelope')}
      </button>
    </form>
  )
}
