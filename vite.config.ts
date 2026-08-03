/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Project pages live under https://<user>.github.io/today/, so every asset URL
// must be prefixed. Routing is hash-based, which keeps deep links working
// without a 404 fallback.
const BASE = '/today/'

// The privacy promise, enforced by the browser rather than asserted in a README.
// `connect-src 'self'` is what makes it real: even a dependency that decided to
// phone home would be blocked. Injected at build time only — the dev server
// needs a websocket for HMR, and production is the artifact that has to hold.
const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const contentSecurityPolicy = (): Plugin => ({
  name: 'today:csp',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) =>
      html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      ),
  },
})

export default defineConfig({
  base: BASE,
  plugins: [
    contentSecurityPolicy(),
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' rather than 'autoUpdate': reloading under someone mid-sentence
      // in a task title is the one thing an offline app must never do.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Everything is precached, so a navigation offline resolves from the
        // cache instead of hitting the network and failing.
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Today — offline-first to-do',
        short_name: 'Today',
        description:
          'Your day, one list. Offline-first and private: tasks never leave your device.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    cssMinify: 'lightningcss',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
