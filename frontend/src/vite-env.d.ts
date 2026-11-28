/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "true" = sample data without a backend. Default: true in dev, false in build. */
  readonly VITE_USE_MOCK?: string
  /** Base path of the Django API. Default: /api */
  readonly VITE_API_BASE?: string
  /** Dev proxy target for /api and /media (read by vite.config.ts). */
  readonly VITE_DEV_PROXY?: string
  /** Independent Control Center origin (no credentials in URL). */
  readonly VITE_ADMIN_FRONTEND_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
