export const API_ROOT = '/api/v1/management'

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
    this.name = 'ApiError'
  }
}

let csrfToken: string | null = null

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const response = await fetch(`${API_ROOT}/auth/csrf`, {
    credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new ApiError(response.status, 'دریافت مجوز امنیتی ناموفق بود.')
  const data = await response.json() as { csrf_token?: string; csrfToken?: string }
  const value = data.csrf_token ?? data.csrfToken
  if (!value) throw new ApiError(500, 'پاسخ مجوز امنیتی معتبر نیست.')
  csrfToken = value
  return value
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; signal?: AbortSignal }

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRFToken', await ensureCsrf())
    if (options.body !== undefined && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    method,
    credentials: 'include',
    cache: 'no-store',
    headers,
    body: options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body),
  })
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  const data: unknown = contentType.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    if (response.status === 403) csrfToken = null
    const detail = typeof data === 'object' && data !== null && 'detail' in data ? String(data.detail) : undefined
    throw new ApiError(response.status, detail ?? 'درخواست انجام نشد. دوباره تلاش کنید.', data)
  }
  return data as T
}

export function params(values: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  const query = search.toString()
  return query ? `?${query}` : ''
}
