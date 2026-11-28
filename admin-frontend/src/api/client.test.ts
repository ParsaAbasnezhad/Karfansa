import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('management API client', () => {
  it('uses the isolated cookie session and CSRF token for mutations without browser token storage', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'csrf-value' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { api } = await import('./client')

    await expect(api<{ id: number }>('/security/users', {
      method: 'POST',
      body: { email: 'admin@example.test' },
    })).resolves.toEqual({ id: 7 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/management/auth/csrf')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/management/security/users')
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(request.credentials).toBe('include')
    expect(request.cache).toBe('no-store')
    expect(new Headers(request.headers).get('X-CSRFToken')).toBe('csrf-value')
    expect(JSON.parse(String(request.body))).toEqual({ email: 'admin@example.test' })
    expect(storageWrite).not.toHaveBeenCalled()
  })
})
