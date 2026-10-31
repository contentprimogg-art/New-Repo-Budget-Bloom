// Génère toutes les icônes à partir des deux sources du dossier branding/:
//   logo.svg         tuile aux coins arrondis (favicon, icônes « any »)
//   logo-square.svg  tuile pleine page (icône iPhone, icône Android « maskable »)
//   badge.svg        silhouette blanche (petite icône des notifications)
// Usage: node scripts/make-icons.mjs
import { copyFileSync } from 'node:fs'
import sharp from 'sharp'

const render = (src, size, out) =>
  sharp(src, { density: 400 }).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/${out}`)

copyFileSync('branding/logo.svg', 'public/favicon.svg')
await Promise.all([
  render('branding/logo.svg', 192, 'icon-192.png'),
  render('branding/logo.svg', 512, 'icon-512.png'),
  render('branding/logo.svg', 32, 'favicon-32.png'),
  render('branding/logo-square.svg', 512, 'icon-maskable-512.png'),
  render('branding/logo-square.svg', 180, 'apple-touch-icon.png'),
  // Icône monochrome des notifications (barre d'état Android).
  render('branding/badge.svg', 96, 'badge-96.png'),
])
console.log('icônes générées dans public/')
