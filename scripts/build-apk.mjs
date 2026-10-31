// Construit l'APK Android signé: site → Capacitor → Gradle, puis copie budget-bloom.apk à la racine.
// Usage: npm run apk
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' })

if (!existsSync('android/app/google-services.json')) {
  console.warn('⚠ android/app/google-services.json absent: l\'APK fonctionnera, mais sans notifications.')
}
run('npm run build')
// L'APK publié avec le site ne doit pas se retrouver à l'intérieur du nouvel APK.
rmSync('dist/budget-bloom.apk', { force: true })
run('npx cap sync android')
const gradlew = process.platform === 'win32' ? join(process.cwd(), 'android', 'gradlew.bat') : './gradlew'
run(`"${gradlew}" assembleRelease`, 'android')

const src = 'android/app/build/outputs/apk/release/app-release.apk'
if (!existsSync(src)) {
  console.error('APK introuvable: le build Android a échoué ?')
  process.exit(1)
}
copyFileSync(src, 'budget-bloom.apk')
// Publié avec le site (bouton « Télécharger » du bandeau sur Android) au prochain déploiement.
copyFileSync(src, 'public/budget-bloom.apk')
console.log('APK prêt: budget-bloom.apk (et public/budget-bloom.apk pour le site)')
