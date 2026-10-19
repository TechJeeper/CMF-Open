import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Relative base + HashRouter lets the same build serve from any GitHub Pages subpath.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'CMF App Store',
        short_name: 'CMF Store',
        description:
          'Unofficial app store for CMF Watch 3 Pro: sideload apps, generative watchfaces, and photo dials over Web Bluetooth.',
        categories: ['utilities', 'lifestyle'],
        lang: 'en-GB',
        theme_color: '#0b0b0b',
        background_color: '#0b0b0b',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: { host: '127.0.0.1', port: 47321, strictPort: true },
  preview: { host: '127.0.0.1', port: 47322, strictPort: true },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 800 },
  test: { environment: 'node' },
})
