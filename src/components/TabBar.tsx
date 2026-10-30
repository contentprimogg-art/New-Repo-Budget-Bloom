import { useTranslation } from 'react-i18next'
import { pageOf, useHash, type Page } from '../lib/route'

const TABS: [Page, string, string][] = [
  ['budget', '#/', 'tabBudget'],
  ['savings', '#/savings', 'tabSavings'],
  ['stats', '#/stats', 'tabStats'],
]

export default function TabBar() {
  const { t } = useTranslation()
  const current = pageOf(useHash())
  return (
    <nav aria-label={t('navigation')} className="no-print flex w-fit rounded-full bg-accent-soft p-0.5 text-sm">
      {TABS.map(([page, href, key]) => (
        <a
          key={page}
          href={href}
          aria-current={current === page ? 'page' : undefined}
          className={`rounded-full px-4 py-1.5 ${
            current === page ? 'bg-surface font-medium text-accent-strong shadow-sm' : 'text-muted hover:text-text'
          }`}
        >
          {t(key)}
        </a>
      ))}
    </nav>
  )
}
