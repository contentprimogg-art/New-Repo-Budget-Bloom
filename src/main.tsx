import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/mrs-saint-delafield'
import '@fontsource-variable/montserrat'
import './i18n'
import './index.css'
import App from './App.tsx'
import { applyFavicon, storedFavicon } from './lib/favicon'
import { applyPalette, applyThemeMode, storedPalette, storedThemeMode, syncThemeColor } from './lib/theme'

// La palette choisie est appliquée avant le premier affichage (pas de flash de l'ancienne couleur).
const palette = storedPalette()
if (palette) applyPalette(palette)
applyThemeMode(storedThemeMode())
// Photo du compte comme icône d'onglet, dès l'ouverture.
applyFavicon(storedFavicon())
// En mode automatique, la barre du navigateur suit le passage clair/sombre du téléphone.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor)

// Mises à jour: quand une nouvelle version est mise en ligne, l'app installée (iPhone, Android)
// la récupère au retour au premier plan puis se recharge d'elle-même, sans rester sur l'ancienne.
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload()
    hadController = true
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void navigator.serviceWorker.getRegistration().then((r) => r?.update())
  })
}

// Aperçu des composants, uniquement en développement (captures d'écran de contrôle).
const Preview = import.meta.env.DEV ? lazy(() => import('./dev/Preview')) : null
const showPreview = Preview && window.location.hash.startsWith('#/__preview')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showPreview && Preview ? (
      <Suspense>
        <Preview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
