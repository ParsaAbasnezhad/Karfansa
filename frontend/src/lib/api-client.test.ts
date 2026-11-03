import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, apiPost, toQueryString } from './api-client'

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
    await expect(apiGet('/markets/', { limit: 4 })).resolves.toEqual({ ok: 1 })
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/markets/?limit=4')
  })

  it('throws ApiError with the status on failure', async () => {
    useFetch({ ok: false, status: 500, json: async () => ({ detail: 'x' }) })
    await expect(apiGet('/markets/')).rejects.toMatchObject({ name: 'ApiError', status: 500 })
    await expect(apiGet('/markets/')).rejects.toBeInstanceOf(ApiError)
  })

  it('sends the CSRF token from the cookie on POST', async () => {
    document.cookie = 'csrftoken=abc123'
    const fetchMock = useFetch({ json: async () => ({ ok: true }) })
    await apiPost('/newsletter/', { email: 'a@b.ir' })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-CSRFToken']).toBe('abc123')
  })
})
