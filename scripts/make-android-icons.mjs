// Icônes et écran de démarrage de l'APK Android, à partir du dossier branding/.
// Usage (après « npx cap add android »): node scripts/make-android-icons.mjs
import { readdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const RES = 'android/app/src/main/res'
const PAPER = '#F8F4ED'

// Fleur seule, centrée dans la zone sûre des icônes adaptatives (66 % du carré).
const FLOWER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F08CB6"/><stop offset="1" stop-color="#DD5A93"/></linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F9BFD6"/><stop offset="1" stop-color="#EE86B1"/></linearGradient>
  </defs>
  <g transform="translate(256 256) scale(0.62)">
    <g opacity="0.94">
      <ellipse cy="-92" rx="47" ry="96" fill="url(#light)" transform="rotate(60)"/>
      <ellipse cy="-92" rx="47" ry="96" fill="url(#light)" transform="rotate(180)"/>
      <ellipse cy="-92" rx="47" ry="96" fill="url(#light)" transform="rotate(300)"/>
      <ellipse cy="-92" rx="47" ry="96" fill="url(#deep)"/>
      <ellipse cy="-92" rx="47" ry="96" fill="url(#deep)" transform="rotate(120)"/>
      <ellipse cy="-92" rx="47" ry="96" fill="url(#deep)" transform="rotate(240)"/>
    </g>
    <circle r="38" fill="#FCF7F0"/>
    <circle r="15" fill="#DD5A93"/>
  </g>
</svg>`

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const png = (src, size) => sharp(Buffer.from(src), { density: 400 }).resize(size, size).png({ compressionLevel: 9 })
const file = (src, size) => sharp(src, { density: 400 }).resize(size, size).png({ compressionLevel: 9 })

for (const [d, k] of Object.entries(DENSITIES)) {
  const dir = `${RES}/mipmap-${d}`
  await file('branding/logo.svg', Math.round(48 * k)).toFile(`${dir}/ic_launcher.png`)
  await file('branding/logo.svg', Math.round(48 * k)).toFile(`${dir}/ic_launcher_round.png`)
  await png(FLOWER, Math.round(108 * k)).toFile(`${dir}/ic_launcher_foreground.png`)
  // Petite icône des notifications (silhouette blanche).
  await file('branding/badge.svg', Math.round(24 * k)).toFile(`${RES}/drawable-${d}/ic_stat_bloom.png`).catch(async () => {
    const { mkdirSync } = await import('node:fs')
    mkdirSync(`${RES}/drawable-${d}`, { recursive: true })
    await file('branding/badge.svg', Math.round(24 * k)).toFile(`${RES}/drawable-${d}/ic_stat_bloom.png`)
  })
}

writeFileSync(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${PAPER}</color>\n</resources>\n`,
)

// Écrans de démarrage: fond papier, fleur au centre, aux dimensions des fichiers existants.
for (const dir of readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
  for (const name of readdirSync(`${RES}/${dir}`).filter((f) => f === 'splash.png')) {
    const path = `${RES}/${dir}/${name}`
    const { width, height } = await sharp(path).metadata()
    const size = Math.round(Math.min(width, height) * 0.42)
    const flower = await png(FLOWER, size).toBuffer()
    const out = await sharp({ create: { width, height, channels: 4, background: PAPER } })
      .composite([{ input: flower, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toBuffer()
    writeFileSync(path, out)
  }
}
console.log('icônes Android générées')
