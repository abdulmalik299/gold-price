import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * For GitHub Pages:
 * - Set VITE_BASE to "/<repo-name>/" in GitHub Actions or local env.
 * - Example: VITE_BASE=/lux-gold-dashboard/
 */
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'speed-test.bin', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Live Gold Monitor',
        short_name: 'Gold Monitor',
        id: '/',
        description: 'Luxury live gold price dashboard with IQD conversion, margin tools, chart history, and offline-ready PWA.',
        theme_color: '#0b0e14',
        background_color: '#0b0e14',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://api.gold-api.com',
            handler: 'NetworkFirst',
            options: { cacheName: 'gold-api', networkTimeoutSeconds: 6 }
          }
        ]
      }
    })
  ],
  build: {
    sourcemap: true
  }
})
