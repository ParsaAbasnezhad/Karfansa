import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet } from '@/lib/api-client'

const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  time: z.string(),
})

export type Health = z.infer<typeof healthSchema>

export function useHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: ({ signal }) => apiGet('/health/', healthSchema, { signal }),
    refetchInterval: 30_000,
    retry: false,
  })
}
