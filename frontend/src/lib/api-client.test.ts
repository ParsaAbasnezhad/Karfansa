import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, apiPatch, apiPost, toQueryString } from './api-client'

describe('toQueryString', () => {
  it('skips empty values and encodes the rest', () => {
    expect(toQueryString({ q: 'دلار', type: undefined, limit: 6, x: '' })).toBe(
      `?q=${encodeURIComponent('دلار')}&limit=6`,
    )
  })
  it('returns an empty string when there is nothing to send', () => {
    expect(toQueryString({})).toBe('')
  })
})

describe('real API mode', () => {
  afterEach(() => vi.unstubAllGlobals())

  const useFetch = (response: Partial<Response> & { json?: () => Promise<unknown> }) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_USE_MOCK', 'false')
    return fetchMock
  }

  it('GETs under /api with the query string', async () => {
    const fetchMock = useFetch({ json: async () => ({ ok: 1 }) })
    await expect(apiGet('/v1/home/slides/', { limit: 4 })).resolves.toEqual({ ok: 1 })
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/v1/home/slides/?limit=4')
  })

  it('throws ApiError with the status on failure', async () => {
    useFetch({ ok: false, status: 500, json: async () => ({ detail: 'x' }) })
    await expect(apiGet('/v1/home/slides/')).rejects.toMatchObject({ name: 'ApiError', status: 500 })
    await expect(apiGet('/v1/home/slides/')).rejects.toBeInstanceOf(ApiError)
  })

  it('sends the CSRF token from the cookie on POST', async () => {
    document.cookie = 'csrftoken=; Max-Age=0; path=/'
    document.cookie = 'csrftoken=abc123'
    const fetchMock = useFetch({ json: async () => ({ ok: true }) })
    await apiPost('/v1/contact/', { message: 'hello' })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-CSRFToken']).toBe('abc123')
  })

  it('sends authenticated profile changes as a CSRF-protected PATCH', async () => {
    document.cookie = 'csrftoken=patch-token'
    const fetchMock = useFetch({ json: async () => ({ first_name: 'سارا' }) })
    await apiPatch('/v1/auth/me', { first_name: 'سارا', last_name: 'احمدی' })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.method).toBe('PATCH')
    expect((init.headers as Record<string, string>)['X-CSRFToken']).toBe('patch-token')
  })

  it('fetches a CSRF token before the first POST', async () => {
    document.cookie = 'csrftoken=; Max-Age=0; path=/'
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      if (input.endsWith('/v1/auth/csrf')) {
        document.cookie = 'csrftoken=fresh-token; path=/'
        return { ok: true, status: 200, json: async () => ({ message: 'fresh-token' }) }
      }
      return { ok: true, status: 201, json: async () => ({ message: 'created' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_USE_MOCK', 'false')

    await apiPost('/v1/auth/register', { email: 'user@example.com' })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/auth/csrf',
      '/api/v1/auth/register',
    ])
    expect((fetchMock.mock.calls[1]![1] as RequestInit).headers).toMatchObject({
      'X-CSRFToken': 'fresh-token',
    })
  })

  it('shows API error messages instead of replacing them with a generic message', async () => {
    useFetch({
      ok: false,
      status: 409,
      json: async () => ({
        error: { code: 'email_exists', message: 'این ایمیل قبلاً ثبت شده است.' },
      }),
    })
    await expect(apiPost('/v1/auth/register', {})).rejects.toMatchObject({
      message: 'این ایمیل قبلاً ثبت شده است.',
    })
  })

  it('uses API mode by default in development so auth requests reach Django', async () => {
    vi.stubEnv('VITE_USE_MOCK', '')
    const fetchMock = useFetch({ json: async () => ({ message: 'ok' }) })
    vi.stubEnv('VITE_USE_MOCK', '')
    await apiPost('/v1/auth/register', { email: 'user@example.com' })
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/v1/auth/register')
  })
})
