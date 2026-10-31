import { ChevronDown, Ellipsis, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtMoney } from '../../lib/format'
import type { Envelope } from '../../lib/types'
import ProgressBar from '../ui/ProgressBar'
import EnvelopeRow from './EnvelopeRow'

const KEY = 'bloomCollapsedGroups'

function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

// Groupe d'enveloppes repliable (ex. « Dépenses variables »): total, nombre de budgets dépassés,
// barre à rayures du groupe, puis ses enveloppes. L'état replié est mémorisé sur l'appareil.
export default function GroupSection({
  id,
  title,
  envelopes,
  spentBy,
  contributors = {},
  onOpen,
  onRename,
  onDelete,
}: {
  id: string
  title: string
  envelopes: Envelope[]
  spentBy: Record<string, number>
  contributors?: Record<string, string[]>
  onOpen: (envelopeId: string) => void
  onRename?: () => void
  onDelete?: () => void
}) {
  const { t, i18n } = useTranslation()
  const money = (n: number) => fmtMoney(n, i18n.language)
  const [collapsed, setCollapsed] = useState(() => readCollapsed()[id] ?? false)
  const [menu, setMenu] = useState(false)

  const budget = envelopes.reduce((s, e) => s + e.budget, 0)
  const spent = envelopes.reduce((s, e) => s + (spentBy[e.id] ?? 0), 0)
  const overCount = envelopes.filter((e) => (spentBy[e.id] ?? 0) > e.budget).length

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...readCollapsed(), [id]: next }))
    } catch {
      /* stockage indisponible */
    }
  }

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
          <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          <span className="truncate text-xs font-semibold uppercase tracking-[0.18em]">{title}</span>
        </button>
        {(onRename || onDelete) && (
          <div className="relative">
            <button type="button" onClick={() => setMenu(!menu)} aria-label={t('groupActions')} aria-expanded={menu} className="no-print rounded-full p-1 text-muted hover:bg-accent-soft">
              <Ellipsis size={18} />
            </button>
            {menu && (
              <div className="fade-up absolute right-0 top-8 z-20 flex w-44 flex-col rounded-2xl border border-border bg-surface p-1 text-sm shadow-lg" onMouseLeave={() => setMenu(false)}>
                {onRename && (
                  <button type="button" onClick={() => (setMenu(false), onRename())} className="rounded-xl px-3 py-2 text-left hover:bg-accent-soft">
                    {t('renameGroup')}
                  </button>
                )}
                {onDelete && (
                  <button type="button" onClick={() => (setMenu(false), onDelete())} className="rounded-xl px-3 py-2 text-left text-over hover:bg-over/10">
                    {t('deleteGroup')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 pl-6 text-xs">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-muted">
          {t('envelopesCount', { count: envelopes.length })}
          {overCount > 0 && (
            <span className="flex items-center gap-1 font-semibold text-over">
              · <TriangleAlert size={12} /> {t('overCount', { count: overCount })}
            </span>
          )}
        </p>
        <span className={`shrink-0 tabular-nums ${spent > budget ? 'font-semibold text-over' : 'text-muted'}`}>
          {money(spent)} / {money(budget)}
        </span>
      </div>
      <div className="mt-2 pl-6">
        <ProgressBar size="sm" spent={spent} budget={budget} label={`${title}: ${money(spent)} / ${money(budget)}`} />
      </div>
      {!collapsed && (
        <ul className="fade-up divide-y divide-dashed divide-muted/30">
          {envelopes.map((e) => (
            <EnvelopeRow key={e.id} envelope={e} spent={spentBy[e.id] ?? 0} contributors={contributors[e.id]} onOpen={() => onOpen(e.id)} />
          ))}
        </ul>
      )}
    </section>
  )
}
