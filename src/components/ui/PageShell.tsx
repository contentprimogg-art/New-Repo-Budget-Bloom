import { House, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ScriptTitle from '../ScriptTitle'
import SideNav, { BottomNav } from '../TabBar'
import { IconButton } from './PageHeader'

// Gabarit de page inspiré de huddle: grand titre manuscrit aligné à gauche, sous-titre discret,
// une action à droite (roue crantée → réglages, ou maison → accueil), contenu en cartes.
//
// La page occupe exactement la hauteur visible de l'écran (100dvh, qui suit les barres du
// navigateur): seul le contenu défile, et la barre d'onglets du bas comme le bouton « + » restent
// toujours visibles, même avec la barre d'adresse de Chrome placée en bas de l'écran.
export default function PageShell({
  title,
  subtitle,
  left,
  action = 'settings',
  wide = false,
  fab,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  left?: React.ReactNode
  /** « settings »: roue crantée vers le profil; « home »: maison vers l'accueil; ou un élément libre. */
  action?: 'settings' | 'home' | React.ReactNode
  wide?: boolean
  /** Bouton flottant, posé au-dessus de la barre d'onglets (hors de la zone qui défile). */
  fab?: React.ReactNode
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const right =
    action === 'settings' ? (
      <span className="lg:hidden">
        <IconButton label={t('settings')} href="#/profile">
          <Settings size={21} />
        </IconButton>
      </span>
    ) : action === 'home' ? (
      <span className="lg:hidden">
        <IconButton label={t('home')} href="#/">
          <House size={21} />
        </IconButton>
      </span>
    ) : (
      action
    )

  return (
    <div className="app-shell flex">
      <SideNav />
      <div className="relative flex min-w-0 flex-1 flex-col">
      <div className="app-scroll min-h-0 flex-1">
        <main
          className={`fade-up mx-auto flex w-full max-w-xl flex-col gap-5 px-5 pb-28 pt-[max(1.75rem,env(safe-area-inset-top))] md:max-w-3xl md:px-8 lg:px-10 lg:pb-16 ${wide ? 'lg:max-w-none 2xl:max-w-[1500px]' : 'lg:max-w-4xl'}`}
        >
          <header className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-1">
              {left && <div className="-ml-2 mt-1.5">{left}</div>}
              <div className="min-w-0">
                <ScriptTitle as="h1" className="truncate pr-2 text-[3.25rem] leading-[1.1]">
                  {title}
                </ScriptTitle>
                {subtitle && <div className="mt-0.5 text-sm text-muted [overflow-wrap:anywhere]">{subtitle}</div>}
              </div>
            </div>
            <div className="mt-1.5 flex shrink-0 items-center gap-3">
              {right}
            </div>
          </header>
          {children}
        </main>
      </div>
      {fab}
      <BottomNav />
      </div>
    </div>
  )
}
