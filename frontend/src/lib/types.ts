// Shape of the Django API responses (see docs/api-contract.md). Dates are ISO 8601 strings.

export interface TickerItem {
  id: number
  title: string
  published_at: string
  url: string
}

export interface Slide {
  id: number
  category: string
  title: string
  excerpt: string
  read_minutes: number
  published_at: string
  image: string
  url: string
}

export interface Market {
  id: string
  title: string
  short_title: string
  subtitle: string
  /** Icon name, for example "dollar", "coins", "bars", "drop". */
  icon: string
  value: number
  /** Percent change; negative means a drop. */
  change: number
  /** Optional points for the small trend chart. */
  spark?: number[]
}

export type TransportType = 'road' | 'sea' | 'rail' | 'air' | 'log' | 'trans'
export type TransportFilter = 'all' | Exclude<TransportType, 'trans'>

export interface TransportCompany {
  id: number
  type: TransportType
  name: string
  description: string
  city: string
  fleet_count: number
  fleet_unit: string
  route_count: number
  route_unit: string
  url: string
}

export type CompanyCategory = 'sup' | 'pro' | 'exp' | 'bor' | 'srv'
export type CompanyFilter = 'all' | CompanyCategory

export interface CompanyNewsItem {
  id: number
  category: CompanyCategory
  company_name: string
  title: string
  image: string
  published_at: string
  url: string
}

export type Counts = Partial<Record<string, number>>

export interface ListResponse<T> {
  results: T[]
}

export interface CountedListResponse<T> extends ListResponse<T> {
  counts: Counts
}

export interface HeadlinesResponse {
  featured: {
    id: number
    category: string
    title: string
    excerpt: string
    image: string
    published_at: string
    is_important: boolean
    url: string
  }
  minis: { id: number; category: string; title: string; image: string; url: string }[]
  latest: { id: number; category: string; title: string; published_at: string; url: string }[]
  popular: { id: number; title: string; url: string }[]
}

export type AnalysisKind = 'all' | 'report' | 'analysis' | 'note'

export interface AnalysisArticle {
  id: number
  kind: Exclude<AnalysisKind, 'all'>
  category: string
  title: string
  excerpt: string
  author: string
  read_minutes: number
  published_at: string
  url: string
}

export interface AnalysisResponse {
  hero: {
    id: number
    tag: string
    title: string
    excerpt: string
    author: string
    read_minutes: number
    image: string
    download_url: string
    url: string
  }
  articles: AnalysisArticle[]
}

export interface Report {
  id: number
  title: string
  pages: number
  url: string
}

export interface Analyst {
  id: number
  name: string
  role: string
  url: string
}

export interface SearchResult {
  id: number
  category: string
  title: string
  excerpt: string
  published_at: string
  url: string
  image?: string
}

export interface SearchResponse {
  query: string
  count: number
  results: SearchResult[]
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  time?: string
}
