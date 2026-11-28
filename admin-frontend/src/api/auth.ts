import { api } from './client'
import type { AdminUser } from './types'

export interface LoginResult {
  mfa_required: boolean
  mfa_setup_required: boolean
  admin?: AdminUser | null
}
export interface MfaSetup { secret: string; provisioning_uri: string }
export interface MfaConfirm { recovery_codes: string[]; admin: AdminUser }

export const authApi = {
  me: (signal?: AbortSignal) => api<AdminUser>('/auth/me', { signal }),
  login: (email: string, password: string) => api<LoginResult>('/auth/login', { method: 'POST', body: { email: email.trim().toLowerCase(), password } }),
  verify: (code: string) => api<AdminUser>('/auth/verify', { method: 'POST', body: { code } }),
  setup: (enrollment_code: string) => api<MfaSetup>('/auth/mfa/setup', { method: 'POST', body: { enrollment_code } }),
  reauth: (password: string, code = '') => api<void>('/auth/reauth', { method: 'POST', body: { password, code } }),
  confirm: (code: string) => api<MfaConfirm>('/auth/mfa/confirm', { method: 'POST', body: { code } }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
}
