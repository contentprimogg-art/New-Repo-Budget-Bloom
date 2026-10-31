import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtDate, fmtMoney, fmtMonth, parseAmount } from '../../lib/format'
import { useOptionalHousehold } from '../../lib/household'
import { IconBadge } from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { countsAsSpent, type ExpenseStatus } from '../../lib/types'
import { MemberAvatar } from '../ui/AvatarStack'
import Sheet from '../ui/Sheet'

type Period = '1' | '3' | '12' | 'all'
type StatusFilter = 'all' | 'counted' | 'settled'

interface Hit {
  id: string
  amount: number
  note: string | null
  spent_on: string
  status: ExpenseStatus
  created_by: string | null
  envelope_id: string
  envelopes: { name: string; month: string; icon: string | null; color: string | null } | null
}

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-xs ${on ? 'border-accent bg-accent-soft font-medium text-accent-strong' : 'border-border text-muted'}`

// Recherche dans toutes les dépenses du foyer: libellé ou montant, période, statut, personne.
export default function SearchSheet({
  householdId,
  onClose,
  onOpen,
}: {
  householdId: string
  onClose: () => void
  onOpen: (envelopeId: string, month: string) => void
}) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const household = useOptionalHousehold()
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<Period>('3')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [member, setMember] = useState<string>('all')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      let q = supabase
        .from('expenses')
        .select('id, amount, note, spent_on, status, created_by, envelope_id, envelopes(name, month, icon, color)')
        .eq('household_id', householdId)
        .order('spent_on', { ascending: false })
        .limit(150)
      // Caractères réservés de la syntaxe de filtre retirés de la saisie.
      const text = query.trim().replace(/[,()*%]/g, ' ').trim()
      if (text) {
        const n = parseAmount(text)
        q = Number.isFinite(n) && n > 0 ? q.or(`note.ilike.*${text}*,amount.eq.${n}`) : q.ilike('note', `%${text}%`)
      }
      if (period !== 'all') {
        const d = new Date()
        d.setMonth(d.getMonth() - Number(period))
        q = q.gte('spent_on', d.toISOString().slice(0, 10))
      }
      if (status === 'counted') q = q.neq('status', 'refunded')
      if (status === 'settled') q = q.neq('status', 'active')
      if (member !== 'all') q = q.eq('created_by', member)
      const { data, error } = await q
      if (error) return setError(error.message)
      setError(null)
      setHits((data ?? []).map((h) => ({ ...h, amount: Number(h.amount) })) as unknown as Hit[])
    }, 250)
    return () => clearTimeout(timer)
  }, [householdId, query, period, status, member])

  const total = (hits ?? []).reduce((s, h) => (countsAsSpent(h.status) ? s + h.amount : s), 0)

  return (
    <Sheet title={t('search')} onClose={onClose}>
      <label className="flex items-center gap-2 border-b-[1.5px] border-dashed border-muted/45 pb-1.5 focus-within:border-solid focus-within:border-accent-strong">
        <Search size={17} className="text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
          className="w-full border-0 bg-transparent text-base outline-none focus:shadow-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label={t('period')} className="flex gap-1.5 overflow-x-auto">
          {(['1', '3', '12', 'all'] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={chip(period === p)}>
              {p === 'all' ? t('allTime') : t('lastMonths', { count: Number(p) })}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={t('colStatus')} className="flex gap-1.5 overflow-x-auto">
          {(['all', 'counted', 'settled'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>
              {s === 'all' ? t('allStatuses') : s === 'counted' ? t('statusActive') : t('refund')}
            </button>
          ))}
        </div>
        {household?.shared && (
          <div role="radiogroup" aria-label={t('addedBy')} className="flex items-center gap-1.5 overflow-x-auto">
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
          {t('resultsCount', { count: hits.length })} · {t('spent')} {fmtMoney(total, lng)}
        </p>
      )}
      <ul className="-mt-1 divide-y divide-dashed divide-muted/30">
        {hits?.map((h) => {
          const author = h.created_by ? household?.memberById[h.created_by] : undefined
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => h.envelopes && onOpen(h.envelope_id, h.envelopes.month)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <IconBadge icon={h.envelopes?.icon} color={h.envelopes?.color} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] ${h.status !== 'active' ? 'text-muted line-through' : ''}`}>{h.note || t('unnamed')}</span>
                  <span className="block truncate text-xs text-muted">
                    {h.envelopes?.name} · {fmtDate(h.spent_on, lng)}
                    {h.envelopes && h.envelopes.month !== h.spent_on.slice(0, 7) && ` (${fmtMonth(h.envelopes.month, lng)})`}
                  </span>
                </span>
                {household?.shared && author && <MemberAvatar member={author} size={20} />}
                <span className="shrink-0 text-[15px] font-medium tabular-nums">{fmtMoney(h.amount, lng)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {hits?.length === 0 && <p className="py-4 text-center text-sm text-muted">{t('noResults')}</p>}
    </Sheet>
  )
}
