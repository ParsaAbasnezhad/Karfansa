// Home page data layer: option lists for the tabs and the React Query hooks for every API call.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type {
  AnalysisKind,
  AnalysisResponse,
  Analyst,
  CountedListResponse,
  HomeSlide,
  ListResponse,
  Market,
  Report,
  TransportCompany,
  TransportFilter,
  TransportType,
} from '@/lib/types'

export interface TransportTypeInfo {
  label: string
  /** CSS class with the card colors (.c-road, .c-sea ...). */
  cls: string
  icon: string
}

export const TRANSPORT_TYPES: Record<TransportType, TransportTypeInfo> = {
  road: { label: 'جاده‌ای', cls: 'c-road', icon: 'truck' },
  sea: { label: 'دریایی', cls: 'c-sea', icon: 'ship' },
  rail: { label: 'ریلی', cls: 'c-rail', icon: 'train' },
  air: { label: 'هوایی', cls: 'c-air', icon: 'send' },
  log: { label: 'لجستیک', cls: 'c-log', icon: 'box' },
  trans: { label: 'ترانزیت', cls: 'c-trans', icon: 'truck' },
}

export const TRANSPORT_TABS: { key: TransportFilter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'road', label: TRANSPORT_TYPES.road.label },
  { key: 'sea', label: TRANSPORT_TYPES.sea.label },
  { key: 'rail', label: TRANSPORT_TYPES.rail.label },
  { key: 'air', label: TRANSPORT_TYPES.air.label },
  { key: 'log', label: TRANSPORT_TYPES.log.label },
]

export const ANALYSIS_TABS: { key: AnalysisKind; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'report', label: 'گزارش فصلی' },
  { key: 'analysis', label: 'تحلیل' },
  { key: 'note', label: 'یادداشت' },
]

// ---- queries ----

export const useSlides = () =>
  useQuery({
    queryKey: ['home', 'slides'],
    queryFn: ({ signal }) => apiGet<ListResponse<HomeSlide>>('/v1/home/slides/', undefined, signal),
    staleTime: 5 * 60_000,
  })

export const useMarkets = () =>
  useQuery({
    queryKey: ['markets'],
    queryFn: ({ signal }) => apiGet<ListResponse<Market>>('/markets/', undefined, signal),
    refetchInterval: 60_000,
  })

export const useTransportCompanies = (type: TransportFilter) =>
  useQuery({
    queryKey: ['transport-companies', type],
    queryFn: ({ signal }) =>
      apiGet<CountedListResponse<TransportCompany>>(
        '/transport-companies/',
        { type, limit: 6 },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

export const useAnalysis = (kind: AnalysisKind) =>
  useQuery({
    queryKey: ['analysis', kind],
    queryFn: ({ signal }) => apiGet<AnalysisResponse>('/analysis/', { kind }, signal),
    placeholderData: keepPreviousData,
  })

export const useReports = () =>
  useQuery({
    queryKey: ['reports'],
    queryFn: ({ signal }) => apiGet<ListResponse<Report>>('/reports/', undefined, signal),
  })

export const useAnalysts = () =>
  useQuery({
    queryKey: ['analysts'],
    queryFn: ({ signal }) => apiGet<ListResponse<Analyst>>('/analysts/', undefined, signal),
  })
