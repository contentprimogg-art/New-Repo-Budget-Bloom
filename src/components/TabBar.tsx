import { ChartPie, PiggyBank, User, Wallet, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { pageOf, useHash, type Page } from '../lib/route'
import ScriptTitle from './ScriptTitle'

const TABS: [Page, string, string, LucideIcon][] = [
  ['budget', '#/', 'tabBudget', Wallet],
  ['savings', '#/savings', 'tabSavings', PiggyBank],
  ['stats', '#/stats', 'tabStats', ChartPie],
  ['profile', '#/profile', 'profileTab', User],
]

// Ordinateur (dès 1024 px): barre latérale fixe, avec les mêmes entrées que sur téléphone.
export default function SideNav() {
  const { t } = useTranslation()
  const current = pageOf(useHash())
  return (
    <nav aria-label={t('navigation')} className="no-print hidden w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface px-3 py-5 lg:flex">
      <a href="#/" className="flex items-center gap-2.5 px-2">
        <img src="/favicon.svg" alt="" className="size-10 shrink-0 rounded-xl" />
        <ScriptTitle className="truncate text-[1.9rem] leading-tight">Budget Bloom</ScriptTitle>
      </a>
      <ul className="flex flex-col gap-1">
        {TABS.map(([page, href, key, Icon]) => {
          const active = current === page
          return (
            <li key={page}>
              <a
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] ${
                  active ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-text hover:bg-accent-soft/50'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                {t(key)}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Téléphone et tablette: barre d'onglets fixe en bas de l'écran.
export function BottomNav() {
  const { t } = useTranslation()
  const current = pageOf(useHash())
  return (
    <nav
      aria-label={t('navigation')}
      className="no-print z-30 shrink-0 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 md:max-w-2xl">
        {TABS.map(([page, href, key, Icon]) => {
          const active = current === page
          return (
            <li key={page}>
              <a
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] md:py-2.5 md:text-xs ${active ? 'font-semibold text-accent-strong' : 'text-muted'}`}
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
