// Thin fetch wrapper for the Django API.
// - Base path from VITE_API_BASE (default /api).
// - Sends Django's CSRF token on POST.
// - With VITE_USE_MOCK=true it answers from built-in sample data instead (no backend needed).

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body?: unknown) {
    super(`API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>

const apiBase = (): string => String(import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

export const isMockMode = (): boolean =>
  String(import.meta.env.VITE_USE_MOCK ?? (import.meta.env.DEV ? 'true' : 'false')) === 'true'

export function toQueryString(params?: QueryParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** Django sets the csrftoken cookie; POST requests must send it back in X-CSRFToken. */
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

export async function apiGet<T>(
  path: string,
  params?: QueryParams,
  signal?: AbortSignal,
): Promise<T> {
  if (isMockMode()) {
    const { mockGet } = await import('./mock-api')
    return mockGet<T>(path, params)
  }
  const res = await fetch(`${apiBase()}${path}${toQueryString(params)}`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    signal,
  })
  if (!res.ok) throw new ApiError(res.status)
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (isMockMode()) {
    const { mockPost } = await import('./mock-api')
    return mockPost<T>(path, body)
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRFToken': csrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
