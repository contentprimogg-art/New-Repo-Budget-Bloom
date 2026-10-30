import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney, parseAmount } from '../lib/format'
import { useHash } from '../lib/route'
import { childrenOf, milestonesOf, totalOf, useSavings } from '../lib/savings'
import { supabase } from '../lib/supabase'
import LanguageSwitch from './LanguageSwitch'
import MilestoneBar from './MilestoneBar'
import SavingsDetail from './SavingsDetail'
import TabBar from './TabBar'

const PREFIX = '#/savings/'

export default function SavingsPage({ householdId }: { householdId: string }) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const hash = useHash()
  const { data, error, loaded, reload } = useSavings(householdId)

  const selectedId = hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null
  const selected = data && selectedId ? data.envelopes.find((e) => e.id === selectedId) : undefined
  if (data && selected) {
    return <SavingsDetail data={data} envelope={selected} householdId={householdId} reload={reload} />
  }

  const top = data?.envelopes.filter((e) => !e.parent_id) ?? []
  const grandTotal = data ? top.reduce((sum, e) => sum + totalOf(data, e.id), 0) : 0

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl md:px-6 xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <TabBar />
        <button onClick={() => supabase.auth.signOut()} className="no-print text-sm text-muted underline">
          {t('signOut')}
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl bg-over/10 px-4 py-3 text-sm text-over">
          <p>{t('errLoad')}</p>
          <p className="mt-1 text-xs opacity-80">{error}</p>
        </div>
      )}

      {data && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t('totalSaved')}</p>
          <p className="text-3xl font-semibold tabular-nums">{money(grandTotal)}</p>
        </section>
      )}
      {loaded && data && top.length === 0 && <p className="text-muted">{t('noSavings')}</p>}

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data &&
          top.map((e) => {
            const total = totalOf(data, e.id)
            const kids = childrenOf(data, e.id)
            return (
              <a
                key={e.id}
                href={`${PREFIX}${e.id}`}
                className="fade-up block rounded-2xl border border-border bg-surface p-4 shadow-sm hover:border-accent"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-medium">{e.name}</h2>
                  <span className="font-semibold tabular-nums text-accent-strong">{money(total)}</span>
                </div>
                {e.target && (
                  <p className="mt-0.5 text-xs text-muted">{t('goalOf', { amount: money(e.target) })}</p>
                )}
                <div className="mt-3">
                  <MilestoneBar balance={total} target={e.target} milestones={milestonesOf(data, e.id)} format={money} />
                </div>
                {kids.length > 0 && (
                  <p className="mt-2 text-xs text-muted">{t('subEnvelopesCount', { count: kids.length })}</p>
                )}
              </a>
            )
          })}
        {data && <NewSavings householdId={householdId} sort={top.length} onAdded={reload} />}
      </div>
      <LanguageSwitch />
    </main>
  )
}

function NewSavings({ householdId, sort, onAdded }: { householdId: string; sort: number; onAdded: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [errors, setErrors] = useState<{ name?: string; target?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const goal = target.trim() === '' ? null : parseAmount(target)
    const found: typeof errors = {}
    if (!name.trim()) found.name = t('errNameRequired')
    if (goal !== null && !(goal > 0)) found.target = t('errAmount')
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    const { error } = await supabase
      .from('savings_envelopes')
      .insert({ household_id: householdId, name: name.trim(), target: goal, sort })
    setBusy(false)
    if (error) return setErrors({ form: `${t('errSave')} (${error.message})` })
    setName('')
    setTarget('')
    onAdded()
  }

  return (
    <form onSubmit={add} noValidate className="no-print flex flex-col gap-2 rounded-2xl border border-dashed border-accent p-4">
      <div>
        <input
          placeholder={t('savingsName')}
          aria-label={t('savingsName')}
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
          placeholder={t('savingsTargetOptional')}
          aria-label={t('savingsTargetOptional')}
          aria-invalid={!!errors.target}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2"
        />
        {errors.target && <p className="mt-1 px-1 text-sm text-over">{errors.target}</p>}
      </div>
      {errors.form && <p className="px-1 text-sm text-over">{errors.form}</p>}
      <button disabled={busy} className="rounded-full bg-accent-strong px-4 py-2 font-medium text-white">
        {t('addSavings')}
      </button>
    </form>
  )
}
