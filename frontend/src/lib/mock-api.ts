// In-browser stand-in for the Django API: same paths, query params and JSON shapes.
// Only loaded when VITE_USE_MOCK=true (dynamic import in api-client.ts).
import * as data from './mock-data'
import { ApiError, type QueryParams } from './api-client'
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

const routes: Record<string, (p: QueryParams) => unknown> = {
  // Slides are managed in Django; mock mode has no authored slide content.
  '/v1/home/slides/': () => ({ results: [] }),
  // Public opportunities are database managed; mock mode does not seed them.
  '/v1/trade/opportunities/': () => ({ results: [], count: 0, page: 1, page_size: 6, total_pages: 0 }),
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
  if (!handler) return Promise.reject(new ApiError(404))
  return Promise.resolve(clone<T>(handler(params)))
}

export function mockPost<T>(path: string, body: unknown): Promise<T> {
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
