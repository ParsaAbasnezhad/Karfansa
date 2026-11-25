// In-browser stand-in for the Django API: same paths, query params and JSON shapes.
// Only loaded when VITE_USE_MOCK=true (dynamic import in api-client.ts).
import * as data from './mock-data'
import { ApiError, type QueryParams } from './api-client'
import type {
  AnalysisAuthor,
  AnalysisCategory,
  AnalysisDetailResponse,
  AnalysisPage,
  AnalysisReport,
} from '@/features/analysis/types'
import type { SearchResponse, SearchResult } from './types'

const clone = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T
const str = (v: QueryParams[string], fallback: string) =>
  v == null || v === '' ? fallback : String(v)
const num = (v: QueryParams[string], fallback: number) =>
  v == null || v === '' ? fallback : Number(v)

function marketQuotes() {
  const categories: Record<string, string> = {
    usd: 'exchange',
    gold18: 'gold',
    tedpix: 'stock',
    brent: 'oil',
  }
  return data.markets.map((market) => {
    const spark = market.spark ?? [market.value]
    const min = Math.min(...spark)
    const max = Math.max(...spark)
    const history = spark.map((point, index) => ({
      value: String(
        Number((market.value * (0.99 + ((point - min) / (max - min || 1)) * 0.02)).toFixed(2)),
      ),
      change_percent: String(market.change),
      observed_at: new Date(Date.now() - (spark.length - index - 1) * 3600_000).toISOString(),
    }))
    const category = categories[market.id] ?? 'exchange'
    return {
      category,
      symbol: market.id,
      name: market.title,
      value: String(market.value),
      currency: market.subtitle.includes('دلار') ? 'USD' : 'IRR',
      unit: market.subtitle,
      change_percent: String(market.change),
      source: 'نمونه',
      observed_at: history.at(-1)?.observed_at ?? new Date().toISOString(),
      is_featured: true,
      history,
    }
  })
}

function marketOverview() {
  return {
    results: marketQuotes(),
    provider: {
      name: 'StreamData',
      website_url: 'https://streamdata.ir',
      rest_base_url: '',
      websocket_url: '',
      rest_requests_per_minute: 60,
      websocket_connections: 5,
      subscription_pricing: '',
      coverage: ['دلار و طلا در بازار ایران', 'شاخص‌ها و سهام بورس تهران', 'نفت و کالاهای جهانی'],
      configured: false,
    },
  }
}

function search(query: string): SearchResponse {
  const q = query.trim()
  const pool: SearchResult[] = [
    ...data.analysis.articles.map((a) => ({
      id: 300 + a.id,
      category: a.category,
      title: a.title,
      excerpt: a.excerpt,
      published_at: a.published_at,
      url: a.url,
    })),
  ]
  const seen = new Set<string>()
  const results = q
    ? pool
        .filter((r) => `${r.title} ${r.excerpt} ${r.category}`.includes(q))
        .filter((r) => !seen.has(r.title) && !!seen.add(r.title))
    : []
  return { query: q, count: results.length, results }
}

function analysisReports(): AnalysisReport[] {
  const categoryNames = [...new Set(data.analysis.articles.map((item) => item.category))]
  const categories: Record<string, AnalysisCategory> = Object.fromEntries(
    categoryNames.map((name) => [
      name,
      {
        slug: name.replace(/[\s‌]+/g, '-'),
        name,
        description: '',
        report_count: data.analysis.articles.filter((item) => item.category === name).length,
      },
    ]),
  )
  const authors: Record<string, AnalysisAuthor> = Object.fromEntries(
    data.analysis.articles.map((item) => [
      item.author,
      {
        full_name: item.author,
        position: 'تحلیلگر اقتصادی',
        biography: '',
        profile_image: null,
        report_count: data.analysis.articles.filter((report) => report.author === item.author).length,
      },
    ]),
  )
  return [
    {
      id: String(data.analysis.hero.id),
      slug: `analysis-${data.analysis.hero.id}`,
      title: data.analysis.hero.title,
      short_description: data.analysis.hero.excerpt,
      cover_image: data.analysis.hero.image,
      category: null,
      report_type: 'economic_analysis',
      author: {
        full_name: data.analysis.hero.author,
        position: 'تحلیلگر اقتصادی',
        biography: '',
        profile_image: null,
        report_count: 1,
      },
      published_at: new Date().toISOString(),
      is_featured: true,
      view_count: 0,
      download_count: 0,
      reading_minutes: data.analysis.hero.read_minutes,
    },
    ...data.analysis.articles.map((item) => ({
      id: String(item.id),
      slug: `analysis-${item.id}`,
      title: item.title,
      short_description: item.excerpt,
      cover_image: null,
      category: categories[item.category],
      report_type: item.kind === 'report' ? 'quarterly_report' : 'economic_analysis',
      author: authors[item.author],
      published_at: item.published_at,
      is_featured: false,
      view_count: 0,
      download_count: 0,
      reading_minutes: item.read_minutes,
    })),
  ]
}

const routes: Record<string, (p: QueryParams) => unknown> = {
  // Slides are managed in Django; mock mode has no authored slide content.
  '/v1/home/slides/': () => ({ results: [] }),
  // Public opportunities are database managed; mock mode does not seed them.
  '/v1/trade/opportunities/': () => ({
    results: [],
    count: 0,
    page: 1,
    page_size: 6,
    total_pages: 0,
  }),
  '/v1/analysis/': (p) => {
    const searchText = str(p.search, '').trim()
    const category = str(p.category, '')
    const reportType = str(p.report_type, '')
    const page = num(p.page, 1)
    const pageSize = num(p.page_size, 12)
    const reports = analysisReports()
      .filter((report) => !category || report.category?.slug === category)
      .filter((report) => !reportType || report.report_type === reportType)
      .filter(
        (report) =>
          !searchText ||
          `${report.title} ${report.short_description} ${report.author?.full_name ?? ''}`.includes(
            searchText,
          ),
      )
    if (str(p.ordering, 'latest') === 'oldest') reports.reverse()
    const result: AnalysisPage = {
      items: reports.slice((page - 1) * pageSize, page * pageSize),
      count: reports.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(reports.length / pageSize),
    }
    return result
  },
  '/v1/analysis/featured/': () => analysisReports().filter((report) => report.is_featured),
  '/v1/analysis/categories/': () => {
    const categories = new Map<string, AnalysisCategory>()
    for (const report of analysisReports()) {
      if (report.category) categories.set(report.category.slug, report.category)
    }
    return [...categories.values()]
  },
  '/v1/analysis/authors/': () => {
    const authors = new Map<string, AnalysisAuthor>()
    for (const report of analysisReports()) {
      if (report.author) authors.set(report.author.full_name, report.author)
    }
    return [...authors.values()]
  },
  '/v1/market/overview/': () => marketOverview(),
  '/v1/market/quotes/': (p) => {
    const category = str(p.category, '')
    return { results: marketQuotes().filter((quote) => !category || quote.category === category) }
  },
  '/v1/market/history/': (p) => {
    const category = str(p.category, '')
    const symbol = str(p.symbol, '')
    const quote = marketQuotes().find(
      (item) => item.category === category && item.symbol === symbol,
    )
    if (!quote) return { category, symbol, name: symbol, currency: '', unit: '', results: [] }
    return {
      category: quote.category,
      symbol: quote.symbol,
      name: quote.name,
      currency: quote.currency,
      unit: quote.unit,
      results: quote.history.slice(-num(p.limit, 100)),
    }
  },
  '/markets/': () => ({ results: data.markets }),
  '/transport-companies/': (p) => {
    const type = str(p.type, 'all')
    const list =
      type === 'all'
        ? data.transportCompanies
            .filter((c) => c.featured)
            .sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0))
        : data.transportCompanies.filter((c) => c.type === type)
    return { counts: data.transportCounts, results: list.slice(0, num(p.limit, 6)) }
  },
  '/analysis/': (p) => {
    const kind = str(p.kind, 'all')
    return {
      hero: data.analysis.hero,
      articles:
        kind === 'all'
          ? data.analysis.articles
          : data.analysis.articles.filter((a) => a.kind === kind),
    }
  },
  '/reports/': () => ({ results: data.reports }),
  '/analysts/': () => ({ results: data.analysts }),
  '/search/': (p) => search(str(p.q, '')),
  '/health/': () => ({ status: 'ok', time: new Date().toISOString() }),
  '/v1/support/tickets/': () => ({
    results: [],
    count: 0,
    page: 1,
    page_size: 8,
    total_pages: 0,
    summary: { total: 0, open: 0, waiting_for_user: 0, answered: 0, unread: 0 },
  }),
}

export function mockGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  const handler = routes[path]
  if (handler) return Promise.resolve(clone<T>(handler(params)))
  const detail = path.match(/^\/v1\/analysis\/([^/]+)\/$/)
  if (detail) {
    const report = analysisReports().find((item) => item.slug === decodeURIComponent(detail[1]))
    if (!report) return Promise.reject(new ApiError(404))
    const result: AnalysisDetailResponse = {
      report: {
        ...report,
        content: `<p>${report.short_description}</p>`,
        seo_title: report.title,
        seo_description: report.short_description,
        attachments: [],
      },
      related: analysisReports().filter((item) => item.slug !== report.slug).slice(0, 3),
    }
    return Promise.resolve(clone<T>(result))
  }
  return Promise.reject(new ApiError(404))
}

export function mockPost<T>(path: string, body: unknown): Promise<T> {
  if (path === '/v1/intents/guest') {
    const payload = body as { goals?: string[] }
    if (!payload.goals?.length) {
      return Promise.reject(new ApiError(400, { error: { message: 'یک هدف انتخاب کنید.' } }))
    }
    return Promise.resolve({ saved: true } as T)
  }
  if (path === '/v1/support/tickets/' || path.startsWith('/v1/support/tickets/')) {
    return Promise.resolve({
      ticket_number: 'KF-20260101-ABC123',
      access_token: null,
      message: 'درخواست پشتیبانی ثبت شد.',
      results: [],
      count: 0,
      page: 1,
      page_size: 8,
      total_pages: 0,
      summary: { total: 0, open: 0, waiting_for_user: 0, answered: 0, unread: 0 },
    } as T)
  }
  if (path === '/v1/contact/') {
    const payload = body as {
      name?: string
      phone?: string
      email?: string
      subject?: string
      message?: string
    }
    if (
      !payload.name?.trim() ||
      !payload.phone ||
      !payload.email?.trim() ||
      !payload.subject?.trim() ||
      !payload.message?.trim()
    ) {
      return Promise.reject(
        new ApiError(400, { error: { message: 'همهٔ فیلدهای فرم تماس الزامی هستند.' } }),
      )
    }
    return Promise.resolve({ message: 'پیام شما با موفقیت ثبت شد.' } as T)
  }
  if (path === '/v1/auth/register') {
    const payload = body as { email?: string; phone?: string; password?: string }
    if (!payload.email || !payload.phone || !payload.password) {
      return Promise.reject(
        new ApiError(400, { error: { message: 'ایمیل، تلفن و گذرواژه الزامی هستند.' } }),
      )
    }
    return Promise.resolve({ message: 'حساب ساخته شد.' } as T)
  }
  if (path === '/v1/auth/password-login') {
    return Promise.resolve({ email: (body as { email?: string }).email, phone: '' } as T)
  }
  if (path === '/v1/auth/password-reset' || path === '/v1/auth/password-reset/confirm') {
    return Promise.resolve({ message: 'درخواست ثبت شد.' } as T)
  }
  return Promise.reject(new ApiError(404))
}
