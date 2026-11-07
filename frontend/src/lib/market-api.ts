import { apiGet, type QueryParams } from './api-client'

export async function getMarketData<T>(
  path: string,
  params?: QueryParams,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await apiGet<T>(path, params, signal)
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw error
    }

    const { mockGet } = await import('./mock-api')
    return mockGet<T>(path, params)
  }
}
