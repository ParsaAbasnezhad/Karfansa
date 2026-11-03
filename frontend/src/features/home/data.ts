// Home page data layer: option lists for the tabs and the React Query hooks for every API call.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type {
  AnalysisKind,
  AnalysisResponse,
  Analyst,
  CompanyFilter,
  CompanyNewsItem,
  CountedListResponse,
  HeadlinesResponse,
  ListResponse,
  Market,
  Report,
  Slide,
  TickerItem,
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

export const COMPANY_CATEGORIES: Record<string, { label: string; cls: string }> = {
  sup: { label: 'تامین‌کنندگان', cls: 'b-sup' },
  pro: { label: 'تولیدکنندگان', cls: 'b-pro' },
  exp: { label: 'صادرکنندگان', cls: 'b-exp' },
  bor: { label: 'شرکت‌های بورسی', cls: 'b-bor' },
  srv: { label: 'خدمات بازرگانی', cls: 'b-srv' },
}

export const COMPANY_TABS: { key: CompanyFilter; label: string }[] = [
  { key: 'all', label: 'همه' },
  ...Object.entries(COMPANY_CATEGORIES).map(([key, v]) => ({
    key: key as CompanyFilter,
    label: v.label,
  })),
]

export const ANALYSIS_TABS: { key: AnalysisKind; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'report', label: 'گزارش فصلی' },
  { key: 'analysis', label: 'تحلیل' },
  { key: 'note', label: 'یادداشت' },
]

// ---- queries ----

export const useTicker = () =>
  useQuery({
    queryKey: ['ticker'],
    queryFn: ({ signal }) => apiGet<ListResponse<TickerItem>>('/ticker/', undefined, signal),
    refetchInterval: 60_000,
  })

export const useSlides = () =>
  useQuery({
    queryKey: ['slides'],
    queryFn: ({ signal }) => apiGet<ListResponse<Slide>>('/slides/', undefined, signal),
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

export const useCompanyNews = (category: CompanyFilter) =>
  useQuery({
    queryKey: ['company-news', category],
    queryFn: ({ signal }) =>
      apiGet<CountedListResponse<CompanyNewsItem>>(
        '/company-news/',
        { category, limit: 8 },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

export const useHeadlines = () =>
  useQuery({
    queryKey: ['headlines'],
    queryFn: ({ signal }) => apiGet<HeadlinesResponse>('/headlines/', undefined, signal),
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
