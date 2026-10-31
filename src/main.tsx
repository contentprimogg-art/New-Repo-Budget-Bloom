import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/mrs-saint-delafield'
import '@fontsource-variable/montserrat'
import './i18n'
import './index.css'
import App from './App.tsx'
import { applyPalette, storedPalette } from './lib/theme'

// La palette choisie est appliquée avant le premier affichage (pas de flash de l'ancienne couleur).
const palette = storedPalette()
if (palette) applyPalette(palette)

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
