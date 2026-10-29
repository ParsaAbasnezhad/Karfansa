import { z } from 'zod'
import { ApiError, apiGet } from './api-client'

const schema = z.object({ status: z.literal('ok') })

function mockFetch(response: Response | Error) {
  const fn = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiGet', () => {
  it('returns validated data and calls the versioned API path', async () => {
    const fetchMock = mockFetch(Response.json({ status: 'ok' }))

    await expect(apiGet('/health/', schema)).resolves.toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health/',
      expect.objectContaining({ credentials: 'same-origin' }),
    )
  })

  it('turns the backend error envelope into an ApiError', async () => {
    mockFetch(
      Response.json(
        { error: { code: 'conflict', message: 'Name is taken.', details: [{ field: 'name' }] } },
        { status: 409 },
      ),
    )

    const error: unknown = await apiGet('/x/', schema).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 'conflict', message: 'Name is taken.' })
  })

  it('handles non-JSON error responses such as proxy pages', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }))

    await expect(apiGet('/x/', schema)).rejects.toMatchObject({ status: 502, code: 'http_error' })
  })

  it('reports an unreachable server as network_error', async () => {
    mockFetch(new TypeError('Failed to fetch'))

    await expect(apiGet('/x/', schema)).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('rejects data that does not match the schema', async () => {
    mockFetch(Response.json({ status: 'weird' }))

    await expect(apiGet('/x/', schema)).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
