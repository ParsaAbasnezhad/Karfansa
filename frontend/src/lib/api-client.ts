// Thin fetch wrapper for the Django API.
// - Base path from VITE_API_BASE (default /api).
// - Sends Django's CSRF token on POST.
// - With VITE_USE_MOCK=true it answers from built-in sample data instead (no backend needed).

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body?: unknown) {
    const envelope = body as { error?: { message?: string } } | null
    super(envelope?.error?.message ?? `درخواست انجام نشد (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>

const apiBase = (): string => String(import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

function fallbackMessage(status: number, body: unknown): string {
  const envelope = body as { error?: { message?: string } } | null
  if (envelope?.error?.message) return envelope.error.message
  if (status === 404) return 'مسیر API پیدا نشد. نشانی یا نسخهٔ API را بررسی کنید.'
  if (status === 403) return 'درخواست از نظر امنیتی رد شد. صفحه را تازه‌سازی و دوباره تلاش کنید.'
  if (status === 429) return 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.'
  if (status >= 500) return 'سرویس موقتاً در دسترس نیست. تنظیمات یا وضعیت سرور را بررسی کنید.'
  return `درخواست انجام نشد (${status}). اطلاعات واردشده را بررسی کنید.`
}

export const isMockMode = (): boolean => String(import.meta.env.VITE_USE_MOCK || 'false') === 'true'

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

let csrfRequest: Promise<string> | null = null

async function getCsrfToken(): Promise<string> {
  const existingToken = csrfToken()
  if (existingToken) return existingToken

  if (!csrfRequest) {
    csrfRequest = (async () => {
      const res = await fetch(`${apiBase()}/v1/auth/csrf`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      })
      let data: unknown = null
      try {
        data = await res.json()
      } catch {
        // empty or non-JSON body
      }
      if (!res.ok)
        throw new ApiError(
          res.status,
          data ?? { error: { message: fallbackMessage(res.status, data) } },
        )

      const token = csrfToken() || (data as { message?: string } | null)?.message || ''
      if (!token) throw new Error('CSRF token was not returned by the API.')
      return token
    })().finally(() => {
      csrfRequest = null
    })
  }
  return csrfRequest
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
  const data = await res.json().catch(() => null)
  if (!res.ok)
    throw new ApiError(
      res.status,
      data ?? { error: { message: fallbackMessage(res.status, data) } },
    )
  return data as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (isMockMode()) {
    const { mockPost } = await import('./mock-api')
    return mockPost<T>(path, body)
  }
  const token = await getCsrfToken()
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRFToken': token,
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
  if (!res.ok)
    throw new ApiError(
      res.status,
      data ?? { error: { message: fallbackMessage(res.status, data) } },
    )
  return data as T
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const token = await getCsrfToken()
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRFToken': token,
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok)
    throw new ApiError(
      res.status,
      data ?? { error: { message: fallbackMessage(res.status, data) } },
    )
  return data as T
}
