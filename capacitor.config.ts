import type { CapacitorConfig } from '@capacitor/cli'

// APK Android (Capacitor). L'appli affiche le site en ligne: chaque mise en ligne (déploiement
// GitHub) arrive dans l'APK sans le réinstaller. Le dossier dist/ sert seulement de secours au build.
const config: CapacitorConfig = {
  appId: 'fr.ciaoprimo.budgetbloom',
  appName: 'Budget Bloom',
  webDir: 'dist',
  server: {
    url: 'https://budgetbloom.ciaoprimo.fr',
    cleartext: false,
  },
  android: {
    backgroundColor: '#F8F4ED',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
