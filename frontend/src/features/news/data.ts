import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { NewsListResponse } from '@/lib/types'

export const useRSSNews = (topic: string, query: string, page: number) =>
  useQuery({
    queryKey: ['rss-news', topic, query, page],
    queryFn: ({ signal }) =>
      apiGet<NewsListResponse>(
        '/v1/news/',
        { topic, q: query, page, page_size: 12 },
        signal,
      ),
    placeholderData: keepPreviousData,
  })
