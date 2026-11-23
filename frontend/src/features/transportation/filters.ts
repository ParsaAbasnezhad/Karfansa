import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export type TransportFiltersState = {
  q: string
  type: string
  province: string
  city: string
  coverage: string
  verified: string
  service: string
  ordering: string
  page: number
}

export const emptyTransportFilters: TransportFiltersState = {
  q: '',
  type: '',
  province: '',
  city: '',
  coverage: '',
  verified: '',
  service: '',
  ordering: '',
  page: 1,
}

export function transportFilterCount(state: TransportFiltersState) {
  return [state.type, state.province, state.city, state.coverage, state.verified, state.service].filter(Boolean)
    .length
}

export function transportIsNarrowed(state: TransportFiltersState) {
  return Boolean(state.q) || transportFilterCount(state) > 0
}

export function useTransportQueryState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo<TransportFiltersState>(
    () => ({
      q: params.get('q') ?? '',
      type: params.get('type') ?? '',
      province: params.get('province') ?? '',
      city: params.get('city') ?? '',
      coverage: params.get('coverage') ?? '',
      verified: params.get('verified') ?? '',
      service: params.get('service') ?? '',
      ordering: params.get('ordering') ?? '',
      page: Math.max(Number(params.get('page') || 1), 1),
    }),
    [params],
  )

  const write = (next: TransportFiltersState) => {
    const search = new URLSearchParams()
    if (next.q) search.set('q', next.q)
    if (next.type) search.set('type', next.type)
    if (next.province) search.set('province', next.province)
    if (next.city) search.set('city', next.city)
    if (next.coverage) search.set('coverage', next.coverage)
    if (next.verified) search.set('verified', next.verified)
    if (next.service) search.set('service', next.service)
    if (next.ordering) search.set('ordering', next.ordering)
    if (next.page > 1) search.set('page', String(next.page))
    setParams(search, { replace: false })
  }

  return { state, write }
}
