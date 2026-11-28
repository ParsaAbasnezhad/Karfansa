import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import {
  isAppNavigation,
  isSensitiveRequest,
  sensitiveRequestMethods,
} from './src/pwa/cachePolicy.ts'

// The browser only ever talks to the Vite server; /api is proxied to Django, so
// in development the app is same-origin (no CORS), exactly like production.
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000'
// Bind mounts on Windows/Docker Desktop do not emit file events; polling fixes hot reload.
const usePolling = process.env.VITE_USE_POLLING === 'true'

// Authentication always needs the Django API. Keep sample data opt-in so a root
// .env setting for the whole Compose stack cannot silently mock auth in local Vite.
const useMock = process.env.VITE_USE_MOCK === 'true'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'test'
      ? []
      : [
          VitePWA({
            registerType: 'prompt',
            injectRegister: null,
            includeManifestIcons: false,
            // Kept in public/manifest.webmanifest so the browser can revalidate
            // it independently. The plugin otherwise adds it to the precache.
            manifest: false,
            workbox: {
              // Keep the precache to the offline document and versioned code.
              // Navigations, product imagery, and other media stay on the network.
              globPatterns: [
                'offline.html',
                'offline.css',
                'offline.js',
                'favicon.svg',
                'icons/*.png',
                'assets/**/*.{js,css,woff2}',
              ],
              maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
              navigateFallback: null,
              cleanupOutdatedCaches: true,
              skipWaiting: false,
              clientsClaim: false,
              runtimeCaching: [
                ...sensitiveRequestMethods.map((method) => ({
                  urlPattern: isSensitiveRequest,
                  handler: 'NetworkOnly' as const,
                  method,
                  options: { fetchOptions: { cache: 'no-store' as const } },
                })),
                {
                  // The reverse proxy serves index.html for SPA routes while online.
                  // A failed navigation receives the dedicated offline document,
                  // never a previously viewed business page.
                  urlPattern: isAppNavigation,
                  handler: 'NetworkOnly',
                  options: { precacheFallback: { fallbackURL: '/offline.html' } },
                },
              ],
            },
            devOptions: { enabled: false },
          }),
        ]),
  ],
  define: {
    'import.meta.env.VITE_USE_MOCK': JSON.stringify(useMock),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: proxyTarget, changeOrigin: false },
      '/media': { target: proxyTarget, changeOrigin: false },
    },
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}))
