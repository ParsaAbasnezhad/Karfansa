import { z } from 'zod'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'

const errorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.record(z.string(), z.unknown())).nullish(),
  }),
})

/** Every failure of an API call is an ApiError, so callers handle one shape. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: readonly Record<string, unknown>[] | null

  constructor(
    status: number,
    code: string,
    message: string,
    details: readonly Record<string, unknown>[] | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const parsed = errorEnvelope.safeParse(await response.json())
    if (parsed.success) {
      const { code, message, details } = parsed.data.error
      return new ApiError(response.status, code, message, details ?? null)
    }
  } catch {
    // Not JSON (for example a proxy error page): fall through to the generic error.
  }
  return new ApiError(
    response.status,
    'http_error',
    `Request failed with status ${response.status}.`,
  )
}

/** GET a JSON endpoint and validate the response with a zod schema. */
export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: options.signal ?? null,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, 'network_error', 'The server could not be reached.')
  }

  if (!response.ok) throw await toApiError(response)

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new ApiError(response.status, 'invalid_response', 'The server returned unexpected data.')
  }
  return parsed.data
}
