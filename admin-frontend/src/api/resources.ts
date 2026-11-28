import { API_ROOT, api, params } from './client'
import type { Paginated, ResourceDescriptor, ResourceRecord } from './types'

export interface TicketMessage {
  id: string
  sender: string
  sender_type: string
  message: string
  is_internal: boolean
  created_at: string
  has_attachment: boolean
}

export const resourceApi = {
  descriptors: (signal?: AbortSignal) => api<ResourceDescriptor[]>('/resources/', { signal }),
  list: (slug: string, query: Record<string, string | number | undefined | null>, signal?: AbortSignal) =>
    api<Paginated<ResourceRecord>>(`/resources/${encodeURIComponent(slug)}${params(query)}`, { signal }),
  get: (slug: string, id: string, signal?: AbortSignal) =>
    api<ResourceRecord>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`, { signal }),
  create: (slug: string, values: Record<string, unknown>) =>
    api<ResourceRecord>(`/resources/${encodeURIComponent(slug)}`, { method: 'POST', body: { data: values } }),
  update: (slug: string, id: string, values: Record<string, unknown>) =>
    api<ResourceRecord>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: { data: values } }),
  delete: (slug: string, id: string) =>
    api<void>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  action: (slug: string, id: string, action: string, values: Record<string, unknown> = {}) =>
    api<ResourceRecord>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/actions/${encodeURIComponent(action)}`, { method: 'POST', body: values }),
  bulk: (slug: string, ids: string[], action: string, reason = '') =>
    api<{ processed: number; ids: string[] }>(`/resources/${encodeURIComponent(slug)}/bulk`, {
      method: 'POST',
      body: { ids, action, reason },
    }),
  multipart: (slug: string, id: string | null, values: Record<string, unknown>, files: Array<[string, File]>, method: 'POST' | 'PATCH') => {
    const body = new FormData()
    body.append('data', JSON.stringify(values))
    for (const [name, file] of files) body.append(name, file)
    const url = id ? `/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/multipart` : `/resources/${encodeURIComponent(slug)}/multipart`
    return api<ResourceRecord>(url, { method, body })
  },
  listInline: (slug: string, id: string, key: string, signal?: AbortSignal) =>
    api<ResourceRecord[]>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/inlines/${encodeURIComponent(key)}`, { signal }),
  syncInline: (slug: string, id: string, key: string, payload: { creates?: Array<Record<string, unknown>>; updates?: Array<Record<string, unknown>>; deletes?: string[] }) =>
    api<{ created: string[]; updated: string[]; deleted: string[] }>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/inlines/${encodeURIComponent(key)}/sync`, { method: 'POST', body: payload }),
  clearFile: (slug: string, id: string, field: string) =>
    api<ResourceRecord>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/files/${encodeURIComponent(field)}/clear`, { method: 'POST', body: {} }),
  uploadFile: (slug: string, id: string, field: string, file: File) => {
    const body = new FormData()
    body.append('upload', file)
    return api<ResourceRecord>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/files/${encodeURIComponent(field)}`, { method: 'POST', body })
  },
  rotateCredential: (slug: string, id: string, field: string, value: string) =>
    api<{ configured: boolean }>(`/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/credentials/${encodeURIComponent(field)}`, { method: 'PUT', body: { value } }),
  privateFile: async (slug: string, id: string) => {
    const response = await fetch(`${API_ROOT}/resources/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/private-file`, {
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('دریافت سند مجاز نیست یا فایل در دسترس نیست.')
    return response.blob()
  },
  ticketMessages: (id: string, signal?: AbortSignal) =>
    api<TicketMessage[]>(`/resources/support/supportticket/${encodeURIComponent(id)}/messages`, { signal }),
  sendTicketMessage: (id: string, message: string, internalNote: boolean, attachment: File | null) => {
    const body = new FormData()
    body.append('message', message)
    body.append('internal_note', String(internalNote))
    if (attachment) body.append('attachment', attachment)
    return api<TicketMessage>(`/resources/support/supportticket/${encodeURIComponent(id)}/messages`, { method: 'POST', body })
  },
  ticketAttachment: async (id: string, messageId: string) => {
    const response = await fetch(`${API_ROOT}/resources/support/supportticket/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/attachment`, {
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('دریافت پیوست مجاز نیست یا فایل در دسترس نیست.')
    return response.blob()
  },
}
