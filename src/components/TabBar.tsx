import { ChartPie, PiggyBank, User, Wallet, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { pageOf, useHash, type Page } from '../lib/route'

const TABS: [Page, string, string, LucideIcon][] = [
  ['budget', '#/', 'tabBudget', Wallet],
  ['savings', '#/savings', 'tabSavings', PiggyBank],
  ['stats', '#/stats', 'tabStats', ChartPie],
  ['profile', '#/profile', 'profileTab', User],
]

// Ordinateur et tablette en largeur: onglets en pilule en haut de page.
export default function TabBar() {
  const { t } = useTranslation()
  const current = pageOf(useHash())
  return (
    <nav aria-label={t('navigation')} className="no-print hidden w-fit rounded-full bg-accent-soft p-0.5 text-sm md:flex">
      {TABS.slice(0, 3).map(([page, href, key]) => (
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

// Téléphone: barre d'onglets fixe en bas de l'écran.
export function BottomNav() {
  const { t } = useTranslation()
  const current = pageOf(useHash())
  return (
    <nav
      aria-label={t('navigation')}
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(([page, href, key, Icon]) => {
          const active = current === page
          return (
            <li key={page}>
              <a
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? 'font-semibold text-accent-strong' : 'text-muted'}`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.7} />
                {t(key)}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
