/** Resolve the independent Control Center origin. Never put credentials in the URL. */
export function controlCenterOrigin(): string {
  const configured = String(import.meta.env.VITE_ADMIN_FRONTEND_URL ?? '')
    .trim()
    .replace(/\/$/, '')
  if (configured) return configured
  if (import.meta.env.DEV) return 'http://127.0.0.1:5174'
  return 'https://console.karfansa.ir'
}

/** Open Control Center root; AuthProvider routes to dashboard or login from session cookie. */
export function openControlCenter(): void {
  window.open(controlCenterOrigin(), '_blank', 'noopener,noreferrer')
}
