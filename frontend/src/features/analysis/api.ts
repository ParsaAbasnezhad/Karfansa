import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type {
  AnalysisAuthor,
  AnalysisCategory,
  AnalysisDetailResponse,
  AnalysisPage,
  AnalysisReport,
} from './types'

export const ANALYSIS_REPORT_TYPES = [
  { value: 'quarterly_report', label: 'گزارش فصلی' },
  { value: 'economic_analysis', label: 'تحلیل اقتصادی' },
  { value: 'expert_note', label: 'یادداشت تخصصی' },
  { value: 'market_report', label: 'گزارش بازار' },
  { value: 'research_report', label: 'گزارش پژوهشی' },
] as const

export function useAnalysisReports(params: {
  search?: string
  category?: string
  report_type?: string
  ordering?: string
  page?: number
  page_size?: number
}) {
  return useQuery({
    queryKey: ['analysis-reports', params],
    queryFn: ({ signal }) =>
      apiGet<AnalysisPage>('/v1/analysis/', params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useAnalysisCategories() {
  return useQuery({
    queryKey: ['analysis-categories'],
    queryFn: ({ signal }) => apiGet<AnalysisCategory[]>('/v1/analysis/categories/', undefined, signal),
    staleTime: 5 * 60_000,
  })
}

export function useFeaturedAnalysis() {
  return useQuery({
    queryKey: ['analysis-featured'],
    queryFn: ({ signal }) => apiGet<AnalysisReport[]>('/v1/analysis/featured/', undefined, signal),
    staleTime: 60_000,
  })
}

export function useAnalysisAuthors() {
  return useQuery({
    queryKey: ['analysis-authors'],
    queryFn: ({ signal }) => apiGet<AnalysisAuthor[]>('/v1/analysis/authors/', undefined, signal),
    staleTime: 5 * 60_000,
  })
}

export function useAnalysisDetail(slug: string) {
  return useQuery({
    queryKey: ['analysis-report', slug],
    queryFn: ({ signal }) =>
      apiGet<AnalysisDetailResponse>(
        `/v1/analysis/${encodeURIComponent(slug)}/`,
        undefined,
        signal,
      ),
    enabled: Boolean(slug),
    retry: false,
  })
}

export function formatAnalysisDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long' }).format(date)
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat('fa-IR').format(Math.ceil(bytes / 1024))} کیلوبایت`
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} مگابایت`
}
