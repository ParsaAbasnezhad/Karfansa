import { api, params } from './client'

export interface SecurityUser { id: number; email: string; phone?: string; first_name?: string; last_name?: string; is_active: boolean; is_staff: boolean; is_superuser: boolean; date_joined?: string; mfa_confirmed?: boolean; suspended?: boolean; role_ids?: number[]; individual_action_codes?: string[] }
export interface SecurityRole { id: number; name: string; description: string; action_codes: string[]; is_active: boolean }
export interface PermissionOption { code: string; label: string; group: string }
export interface DjangoGroup { id: number; name: string; permission_ids: number[]; permission_labels: string[]; member_count: number; member_ids: number[] }
export interface DjangoPermissionOption { id: number; code: string; label: string; group: string }
export interface ObjectGrant { id: number; app_label: string; model_name: string; object_id: string; actions: string[] }
export interface AuditEntry { id: number; actor?: string; action: string; target_app?: string; target_model?: string; target_id?: string; created_at: string; result?: string }
export interface AdminSession { id: number; created_at?: string; last_seen_at?: string; ip_address?: string; user_agent?: string; active?: boolean }
export interface Page<T> { items: T[]; total: number; limit: number; offset: number }

export const securityApi = {
  users: (q: string, limit: number, offset: number, signal?: AbortSignal) => api<Page<SecurityUser>>(`/security/users${params({ q, limit, offset })}`, { signal }),
  user: (id: number, signal?: AbortSignal) => api<SecurityUser>(`/security/users/${id}`, { signal }),
  createUser: (body: { email: string; phone: string; first_name: string; last_name: string; administrator: boolean }) => api<{ user: SecurityUser; enrollment_code: string | null }>('/security/users', { method: 'POST', body }),
  updateUser: (id: number, body: { first_name: string; last_name: string }) => api<SecurityUser>(`/security/users/${id}`, { method: 'PATCH', body }),
  userAction: (id: number, action: 'suspend' | 'reactivate' | 'password-reset') => api<void>(`/security/users/${id}/${action}`, { method: 'POST' }),
  grantAdministrator: (id: number) => api<{ user: SecurityUser; enrollment_code: string }>(`/security/users/${id}/grant-administrator`, { method: 'POST' }),
  revokeAdministrator: (id: number) => api<SecurityUser>(`/security/users/${id}/revoke-administrator`, { method: 'POST' }),
  roles: (signal?: AbortSignal) => api<{ items: SecurityRole[]; total: number }>('/security/roles', { signal }),
  permissions: (signal?: AbortSignal) => api<PermissionOption[]>('/security/permissions', { signal }),
  groups: (signal?: AbortSignal) => api<{ items: DjangoGroup[]; total: number }>('/security/groups', { signal }),
  group: (id: number, signal?: AbortSignal) => api<DjangoGroup>(`/security/groups/${id}`, { signal }),
  groupPermissions: (signal?: AbortSignal) => api<DjangoPermissionOption[]>('/security/groups/permissions', { signal }),
  saveGroup: (body: { name: string; permission_ids: number[] }, id?: number) => api<DjangoGroup>(id ? `/security/groups/${id}` : '/security/groups', { method: id ? 'PATCH' : 'POST', body }),
  deleteGroup: (id: number) => api<void>(`/security/groups/${id}`, { method: 'DELETE' }),
  setGroupMembers: (id: number, user_ids: number[]) => api<DjangoGroup>(`/security/groups/${id}/members`, { method: 'PUT', body: { user_ids } }),
  objectGrants: (id: number, signal?: AbortSignal) => api<Page<ObjectGrant>>(`/security/users/${id}/object-grants${params({ limit: 100, offset: 0 })}`, { signal }),
  setObjectGrant: (id: number, app: string, model: string, objectId: string, actions: string[]) =>
    api<ObjectGrant>(`/security/users/${id}/object-grants/${encodeURIComponent(app)}/${encodeURIComponent(model)}/${encodeURIComponent(objectId)}`, { method: 'PUT', body: { actions } }),
  revokeObjectGrant: (id: number, app: string, model: string, objectId: string) =>
    api<void>(`/security/users/${id}/object-grants/${encodeURIComponent(app)}/${encodeURIComponent(model)}/${encodeURIComponent(objectId)}`, { method: 'DELETE' }),
  saveRole: (body: Omit<SecurityRole, 'id'>, id?: number) => api<SecurityRole>(id ? `/security/roles/${id}` : '/security/roles', { method: id ? 'PATCH' : 'POST', body }),
  duplicateRole: (id: number) => api<SecurityRole>(`/security/roles/${id}/duplicate`, { method: 'POST' }),
  setRoles: (id: number, role_ids: number[]) => api<void>(`/security/users/${id}/roles`, { method: 'PUT', body: { role_ids } }),
  setPermissions: (id: number, action_codes: string[]) => api<void>(`/security/users/${id}/permissions`, { method: 'PUT', body: { action_codes } }),
  sessions: (id: number, signal?: AbortSignal) => api<{ items: AdminSession[] }>(`/security/users/${id}/sessions`, { signal }),
  revokeSessions: (id: number) => api<void>(`/security/users/${id}/sessions/revoke`, { method: 'POST' }),
  audit: (limit: number, offset: number, action?: string, signal?: AbortSignal) => api<Page<AuditEntry>>(`/security/audit${params({ limit, offset, action })}`, { signal }),
}
