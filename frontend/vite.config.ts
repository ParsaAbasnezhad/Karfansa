import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The browser only ever talks to the Vite server; /api is proxied to Django, so
// in development the app is same-origin (no CORS), exactly like production.
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000'
// Bind mounts on Windows/Docker Desktop do not emit file events; polling fixes hot reload.
const usePolling = process.env.VITE_USE_POLLING === 'true'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: proxyTarget, changeOrigin: false } },
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
