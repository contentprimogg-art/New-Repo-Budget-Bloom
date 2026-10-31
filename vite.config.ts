import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Accessible depuis le téléphone sur le même Wi-Fi (http://<IP du PC>:5173).
  server: { host: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // La conversion HEIC (≈ 1,3 Mo) n'est téléchargée que si nécessaire, pas mise en cache d'office.
        globIgnores: ['**/heic2any-*.js'],
        // Réception et affichage des notifications (public/push-sw.js).
        importScripts: ['push-sw.js'],
        // Mode hors-ligne: lectures Supabase « réseau d'abord », dernière version connue sans réseau.
        // Ce cache est effacé à la déconnexion (lib/session.ts).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 300, maxAgeSeconds: 14 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Budget Bloom',
        short_name: 'Bloom',
        description: 'Enveloppes budgétaires',
        lang: 'fr',
        theme_color: '#F8F4ED',
        background_color: '#F8F4ED',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
