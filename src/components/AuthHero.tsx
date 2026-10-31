import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SAVED_PHOTO } from '../lib/profile'

function savedPhoto() {
  try {
    return localStorage.getItem(SAVED_PHOTO)
  } catch {
    return null
  }
}

// Carte d'accueil façon appli bancaire: une seule image, la photo de profil mémorisée sur cet
// appareil; sans photo, un dégradé doux sans aucun texte.
export default function AuthHero({ greetingName }: { greetingName?: string | null }) {
  const { t } = useTranslation()
  const [photo] = useState(savedPhoto)

  // La barre d'état du téléphone prend la couleur du haut de la carte (effet « plein écran »).
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previous = meta?.content
    if (meta) meta.content = photo ? '#1A1D20' : '#F9E1EC'
    return () => {
      if (meta && previous) meta.content = previous
    }
  }, [photo])

  return (
    <div className="relative w-full overflow-hidden rounded-b-4xl shadow-lg shadow-accent/20 md:rounded-4xl">
      <div className="relative h-[46dvh] min-h-72 md:aspect-4/5 md:h-auto">
        {photo ? (
          <>
            <img src={photo} alt="" className="size-full object-cover" />
            {greetingName && (
              <div className="absolute bottom-6 left-0 flex -rotate-2 flex-col items-start gap-1.5">
                <span className="max-w-[90%] truncate rounded-r-lg bg-surface px-4 py-1.5 text-xl font-extrabold uppercase tracking-tight text-accent-strong shadow-sm">
                  {t('authGreeting', { name: greetingName })}
                </span>
                <span className="ml-4 rounded-lg bg-surface px-4 py-1.5 text-xl font-extrabold uppercase tracking-tight text-accent-strong shadow-sm">
                  {t('authGreetingSub')}
                </span>
              </div>
            )}
          </>
        ) : (
          <div aria-hidden className="hero-gradient size-full" />
        )}
      </div>
    </div>
  )
}
