import { useQuery } from '@tanstack/react-query'
import { apiGet, isMockMode } from '@/lib/api-client'

export interface AuthUser {
  email: string
  phone: string
  first_name: string
  last_name: string
  date_joined: string
  province_id: number | null
  province_name: string | null
  city_id: number | null
  city_name: string | null
}

export const useAuth = () =>
  useQuery({
    queryKey: ['auth-user'],
    queryFn: ({ signal }) => apiGet<AuthUser>('/v1/auth/me', undefined, signal),
    enabled: !isMockMode(),
    retry: false,
  })
