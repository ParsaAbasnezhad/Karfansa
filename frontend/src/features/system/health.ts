import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { HealthResponse } from '@/lib/types'

export type HealthState = 'checking' | 'ok' | 'degraded' | 'offline'

/** Polls GET /api/health/ once a minute. A failed request means the API is offline. */
export function useHealth(): { state: HealthState; time?: string } {
  const q = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiGet<HealthResponse>('/health/', undefined, signal),
    refetchInterval: 60_000,
    retry: false,
  })
  if (q.isError) return { state: 'offline' }
  if (!q.data) return { state: 'checking' }
  return { state: q.data.status === 'ok' ? 'ok' : 'degraded', time: q.data.time }
}
