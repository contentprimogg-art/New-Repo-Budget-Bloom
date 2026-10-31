import { House, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ScriptTitle from '../ScriptTitle'
import TabBar, { BottomNav } from '../TabBar'
import { IconButton } from './PageHeader'

// Gabarit de page inspiré de huddle: grand titre manuscrit aligné à gauche, sous-titre discret,
// une action à droite (roue crantée → réglages, ou maison → accueil), contenu en cartes,
// barre d'onglets en bas sur téléphone.
export default function PageShell({
  title,
  subtitle,
  left,
  action = 'settings',
  wide = false,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  left?: React.ReactNode
  /** « settings »: roue crantée vers le profil; « home »: maison vers l'accueil; ou un élément libre. */
  action?: 'settings' | 'home' | React.ReactNode
  wide?: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const right =
    action === 'settings' ? (
      <IconButton label={t('settings')} href="#/profile">
        <Settings size={21} />
      </IconButton>
    ) : action === 'home' ? (
      <IconButton label={t('home')} href="#/">
        <House size={21} />
      </IconButton>
    ) : (
      action
    )

  return (
    <main
      className={`fade-up mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 pb-36 pt-[max(1.75rem,env(safe-area-inset-top))] md:pb-16 ${wide ? 'lg:max-w-5xl' : ''}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-1">
          {left && <div className="-ml-2 mt-1.5">{left}</div>}
          <div className="min-w-0">
            <ScriptTitle as="h1" className="truncate pr-2 text-[3.25rem] leading-[1.1]">
              {title}
            </ScriptTitle>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
        </div>
        <div className="mt-1.5 flex shrink-0 items-center gap-3">
          <TabBar />
          {right}
        </div>
      </header>
      {children}
      <BottomNav />
    </main>
  )
}
