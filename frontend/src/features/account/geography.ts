import { useQuery } from '@tanstack/react-query'
import { apiGet, isMockMode } from '@/lib/api-client'

export interface ProvinceOption {
  id: number
  name_fa: string
}

export interface CityOption {
  id: number
  name_fa: string
  province_id: number
}

export const useIranProvinces = () =>
  useQuery({
    queryKey: ['iran-provinces'],
    queryFn: ({ signal }) =>
      apiGet<ProvinceOption[]>('/v1/geography/provinces/', { country: 'IR' }, signal),
    enabled: !isMockMode(),
    staleTime: Infinity,
  })

export const useProvinceCities = (provinceId: string) =>
  useQuery({
    queryKey: ['province-cities', provinceId],
    queryFn: ({ signal }) =>
      apiGet<CityOption[]>('/v1/geography/cities/', { province_id: provinceId }, signal),
    enabled: Boolean(provinceId) && !isMockMode(),
    staleTime: Infinity,
  })
