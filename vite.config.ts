import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'
import tailwindcss      from '@tailwindcss/vite'
import { VitePWA }      from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      // Registra il SW in automatico e aggiorna in background
      registerType:   'autoUpdate',
      injectRegister: 'auto',

      // Asset da includere nella precache oltre a quelli rilevati da Vite
      includeAssets: [
        'favicon.svg',
        'icon-192.png',
        'icon-512.png',
        'apple-touch-icon.png',
      ],

      // ── Web App Manifest ─────────────────────────────────────────────────
      manifest: {
        name:             'Allenamento',
        short_name:       'Allena',
        description:      'Traccia i tuoi allenamenti in palestra e a casa. Offline-first.',
        theme_color:      '#0f172a',
        background_color: '#0f172a',
        display:          'standalone',
        orientation:      'portrait',
        start_url:        '/',
        scope:            '/',
        lang:             'it',
        icons: [
          {
            src:     '/icon-192.png',
            sizes:   '192x192',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-512.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'any',
          },
          {
            // Maskable: Android usa quest'icona adattiva (safe area)
            src:     '/icon-512.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'maskable',
          },
        ],
      },

      // ── Workbox ──────────────────────────────────────────────────────────
      workbox: {
        // Precache l'intera app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // Offline fallback: se una navigazione fallisce, servi index.html
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],

        // Runtime caching aggiuntivo
        runtimeCaching: [
          // Google Fonts (stylesheet)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler:    'CacheFirst' as const,
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries:    10,
                maxAgeSeconds: 60 * 60 * 24 * 365,  // 1 anno
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts (file font)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler:    'CacheFirst' as const,
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries:    30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Immagini generiche (es. future icone caricate a runtime)
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler:    'CacheFirst' as const,
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries:    60,
                maxAgeSeconds: 60 * 60 * 24 * 30,   // 30 giorni
              },
            },
          },
        ],

        // Pulisce i vecchi SW quando si aggiorna
        cleanupOutdatedCaches: true,

        // Skip waiting: il nuovo SW diventa attivo subito
        skipWaiting: true,
        clientsClaim: true,
      },

      // ── Dev options ──────────────────────────────────────────────────────
      devOptions: {
        // Abilita il SW anche in dev (utile per testare offline)
        enabled: false,   // mettere true solo per debug del SW
        type:    'module',
      },
    }),
  ],
})
