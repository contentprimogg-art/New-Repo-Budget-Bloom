import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtDate, fmtMoney, fmtMonth, parseAmount } from '../../lib/format'
import { useOptionalHousehold } from '../../lib/household'
import { IconBadge } from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { countsAsSpent, type ExpenseStatus, type Income } from '../../lib/types'
import { MemberAvatar } from '../ui/AvatarStack'
import Sheet from '../ui/Sheet'

type Period = '1' | '3' | '12' | 'all'
type StatusFilter = 'all' | 'counted' | 'settled'
export type SearchKind = 'expenses' | 'incomes' | 'savings'

/** Où mène un résultat. */
export type SearchTarget =
  | { kind: 'envelope'; id: string; month: string }
  | { kind: 'income'; income: Income }
  | { kind: 'savings'; id: string }

interface Hit {
  id: string
  title: string
  detail: string
  amount: number
  /** Barré: dépense remboursée ou mise de côté. */
  struck: boolean
  /** Compte dans le total affiché (les remboursées libérées non). */
  counts: boolean
  icon: string | null
  color: string | null
  author: string | null
  original?: string
  target: SearchTarget
}

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-xs ${on ? 'border-accent bg-accent-soft font-medium text-accent-strong' : 'border-border text-muted'}`

function sinceDate(period: Period) {
  const d = new Date()
  d.setMonth(d.getMonth() - Number(period))
  return d.toISOString().slice(0, 10)
}

// Recherche dans le foyer: dépenses, revenus ou mouvements d'épargne. Libellé ou montant,
// période, statut (dépenses), personne.
export default function SearchSheet({
  householdId,
  initialKind = 'expenses',
  onClose,
  onOpen,
}: {
  householdId: string
  initialKind?: SearchKind
  onClose: () => void
  onOpen: (target: SearchTarget) => void
}) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const household = useOptionalHousehold()
  const [kind, setKind] = useState<SearchKind>(initialKind)
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<Period>('3')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [member, setMember] = useState<string>('all')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Caractères réservés de la syntaxe de filtre retirés de la saisie.
      const text = query.trim().replace(/[,()*%]/g, ' ').trim()
      const n = text ? parseAmount(text) : NaN
      const isAmount = Number.isFinite(n) && n > 0
      const since = period === 'all' ? null : sinceDate(period)
      const by = member === 'all' ? null : member
      let result: { hits: Hit[]; error: string | null }

      if (kind === 'expenses') {
        let q = supabase
          .from('expenses')
          .select('*, envelopes(name, month, icon, color)')
          .eq('household_id', householdId)
          .order('spent_on', { ascending: false })
          .limit(150)
        if (text) q = isAmount ? q.or(`note.ilike.*${text}*,amount.eq.${n}`) : q.ilike('note', `%${text}%`)
        if (since) q = q.gte('spent_on', since)
        if (status === 'counted') q = q.neq('status', 'refunded')
        if (status === 'settled') q = q.neq('status', 'active')
        if (by) q = q.eq('created_by', by)
        const { data, error } = await q
        result = {
          error: error?.message ?? null,
          hits: (data ?? []).map((h) => {
            const env = h.envelopes as { name: string; month: string; icon: string | null; color: string | null } | null
            const st = h.status as ExpenseStatus
            const other = env && env.month !== (h.spent_on as string).slice(0, 7) ? ` (${fmtMonth(env.month, lng)})` : ''
            return {
              id: h.id,
              title: h.note || t('unnamed'),
              detail: `${env?.name ?? ''} · ${fmtDate(h.spent_on, lng)}${other}`,
              amount: Number(h.amount),
              struck: st !== 'active',
              counts: countsAsSpent(st),
              icon: env?.icon ?? null,
              color: env?.color ?? null,
              author: h.created_by,
              original: h.original_currency ? fmtMoney(Number(h.original_amount), lng, h.original_currency) : undefined,
              target: { kind: 'envelope', id: h.envelope_id, month: env?.month ?? (h.spent_on as string).slice(0, 7) },
            } satisfies Hit
          }),
        }
      } else if (kind === 'incomes') {
        let q = supabase.from('incomes').select('*').eq('household_id', householdId).order('received_on', { ascending: false }).limit(150)
        if (text) q = isAmount ? q.or(`label.ilike.*${text}*,amount.eq.${n}`) : q.ilike('label', `%${text}%`)
        if (since) q = q.gte('received_on', since)
        if (by) q = q.eq('created_by', by)
        const { data, error } = await q
        result = {
          error: error?.message ?? null,
          hits: ((data ?? []) as Income[]).map((i) => ({
            id: i.id,
            title: i.label,
            detail: `${t('incomes')} · ${fmtDate(i.received_on, lng)}`,
            amount: Number(i.amount),
            struck: false,
            counts: true,
            icon: i.icon ?? '💶',
            color: i.color ?? '#E2F3E6',
            author: i.created_by ?? null,
            target: { kind: 'income', income: { ...i, amount: Number(i.amount) } },
          })),
        }
      } else {
        // Épargne: les mouvements (libellé ou montant, dépôt comme retrait), et les pots dont le nom correspond.
        let q = supabase
          .from('savings_entries')
          .select('*, savings_envelopes(name, icon, color)')
          .eq('household_id', householdId)
          .order('entry_date', { ascending: false })
          .limit(150)
        if (text) q = isAmount ? q.or(`note.ilike.*${text}*,amount.eq.${n},amount.eq.${-n}`) : q.ilike('note', `%${text}%`)
        if (since) q = q.gte('entry_date', since)
        if (by) q = q.eq('created_by', by)
        const pots =
          text && !isAmount
            ? await supabase.from('savings_envelopes').select('id, name, icon, color').eq('household_id', householdId).ilike('name', `%${text}%`).limit(20)
            : null
        const { data, error } = await q
        const potHits: Hit[] = (pots?.data ?? []).map((p) => ({
          id: `pot-${p.id}`,
          title: p.name,
          detail: t('savingsEnvelopes'),
          amount: NaN,
          struck: false,
          counts: false,
          icon: p.icon ?? 'piggy',
          color: p.color,
          author: null,
          target: { kind: 'savings', id: p.id },
        }))
        result = {
          error: error?.message ?? pots?.error?.message ?? null,
          hits: [
            ...potHits,
            ...(data ?? []).map((e) => {
              const pot = e.savings_envelopes as { name: string; icon: string | null; color: string | null } | null
              const amount = Number(e.amount)
              return {
                id: e.id,
                title: e.note || (amount > 0 ? t('deposit') : t('withdrawal')),
                detail: `${pot?.name ?? ''} · ${fmtDate(e.entry_date, lng)}`,
                amount,
                struck: false,
                counts: true,
                icon: pot?.icon ?? 'piggy',
                color: pot?.color ?? null,
                author: e.created_by,
                target: { kind: 'savings', id: e.savings_id },
              } satisfies Hit
            }),
          ],
        }
      }
      if (result.error) return setError(result.error)
      setError(null)
      setHits(result.hits)
    }, 250)
    return () => clearTimeout(timer)
  }, [householdId, kind, query, period, status, member, lng, t])

  const counted = (hits ?? []).filter((h) => h.counts && Number.isFinite(h.amount))
  const total = counted.reduce((s, h) => s + h.amount, 0)
  const totalLabel = kind === 'expenses' ? t('spent') : kind === 'incomes' ? t('incomes') : t('netSaved')

  return (
    <Sheet title={t('search')} onClose={onClose}>
      <div role="tablist" aria-label={t('search')} className="grid grid-cols-3 rounded-full border border-border p-0.5 text-sm">
        {(['expenses', 'incomes', 'savings'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k)
              setHits(null)
            }}
            className={`rounded-full py-1.5 ${kind === k ? 'bg-accent-strong font-medium text-on-accent' : 'text-muted'}`}
          >
            {k === 'expenses' ? t('spentShort') : k === 'incomes' ? t('incomes') : t('tabSavings')}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 border-b-[1.5px] border-dashed border-muted/45 pb-1.5 focus-within:border-solid focus-within:border-accent-strong">
        <Search size={17} className="text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={kind === 'expenses' ? t('searchPlaceholder') : kind === 'incomes' ? t('searchIncomePlaceholder') : t('searchSavingsPlaceholder')}
          aria-label={t('search')}
          className="w-full border-0 bg-transparent text-base outline-none focus:shadow-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label={t('period')} className="-m-1 flex gap-1.5 overflow-x-auto p-1">
          {(['1', '3', '12', 'all'] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={chip(period === p)}>
              {p === 'all' ? t('allTime') : t('lastMonths', { count: Number(p) })}
            </button>
          ))}
        </div>
        {kind === 'expenses' && (
          <div role="radiogroup" aria-label={t('colStatus')} className="-m-1 flex gap-1.5 overflow-x-auto p-1">
            {(['all', 'counted', 'settled'] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>
                {s === 'all' ? t('allStatuses') : s === 'counted' ? t('statusActive') : t('refund')}
              </button>
            ))}
          </div>
        )}
        {household?.shared && (
          <div role="radiogroup" aria-label={t('addedBy')} className="-m-1 flex items-center gap-1.5 overflow-x-auto p-1">
            <button type="button" role="radio" aria-checked={member === 'all'} onClick={() => setMember('all')} className={chip(member === 'all')}>
              {t('everyone')}
            </button>
            {household.members.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={member === m.id}
                onClick={() => setMember(m.id)}
                className={`${chip(member === m.id)} flex items-center gap-1.5`}
              >
                <MemberAvatar member={m} size={18} /> {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-over">{error}</p>}
      {hits && (
        <p className="text-xs text-muted">
          {t('resultsCount', { count: hits.length })} · {totalLabel} {fmtMoney(total, lng)}
        </p>
      )}
      <ul className="-mt-1 divide-y divide-dashed divide-muted/30">
        {hits?.map((h) => {
          const author = h.author ? household?.memberById[h.author] : undefined
          const signed = kind === 'savings' && h.amount > 0 ? `+${fmtMoney(h.amount, lng)}` : fmtMoney(h.amount, lng)
          return (
            <li key={h.id}>
              <button type="button" onClick={() => onOpen(h.target)} className="flex w-full items-center gap-3 py-3 text-left">
                <IconBadge icon={h.icon} color={h.color} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] ${h.struck ? 'text-muted line-through' : ''}`}>{h.title}</span>
                  <span className="block truncate text-xs text-muted">{h.detail}</span>
                </span>
                {household?.shared && author && <MemberAvatar member={author} size={20} />}
                {Number.isFinite(h.amount) && (
                  <span className="flex shrink-0 flex-col items-end">
                    <span className={`text-[15px] font-medium tabular-nums ${kind === 'incomes' || (kind === 'savings' && h.amount > 0) ? 'text-ok-ink' : ''}`}>
                      {signed}
                    </span>
                    {h.original && <span className="text-[11px] text-muted tabular-nums">{h.original}</span>}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {hits?.length === 0 && <p className="py-4 text-center text-sm text-muted">{t('noResults')}</p>}
    </Sheet>
  )
}
