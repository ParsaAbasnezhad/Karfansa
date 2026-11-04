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

function search(query: string): SearchResponse {
  const q = query.trim()
  const pool: SearchResult[] = [
    ...data.slides.map((s) => ({
      id: s.id,
      category: s.category,
      title: s.title,
      excerpt: s.excerpt,
      published_at: s.published_at,
      url: s.url,
      image: s.image,
    })),
    ...data.companyNews.map((n) => ({
      id: 100 + n.id,
      category: n.company_name,
      title: n.title,
      excerpt: '',
      published_at: n.published_at,
      url: n.url,
      image: n.image,
    })),
    ...data.headlines.latest.map((l) => ({
      id: 200 + l.id,
      category: l.category,
      title: l.title,
      excerpt: '',
      published_at: l.published_at,
      url: l.url,
    })),
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
  '/ticker/': () => ({ results: data.ticker }),
  '/v1/home/slides/': () => ({
    results: data.slides.map((slide) => ({
      id: slide.id,
      title: slide.title,
      short_text: slide.excerpt,
      description: slide.excerpt,
      image: slide.image,
      created_at: slide.published_at,
    })),
  }),
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
  '/company-news/': (p) => {
    const category = str(p.category, 'all')
    const list =
      category === 'all'
        ? data.companyNews
        : data.companyNews.filter((n) => n.category === category)
    return { counts: data.companyNewsCounts, results: list.slice(0, num(p.limit, 8)) }
  },
  '/headlines/': () => data.headlines,
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
}

export function mockGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  const handler = routes[path]
  if (!handler) return Promise.reject(new ApiError(404))
  return Promise.resolve(clone<T>(handler(params)))
}

export function mockPost<T>(path: string, body: unknown): Promise<T> {
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
  if (path === '/newsletter/') {
    const email = (body as { email?: string } | null)?.email ?? ''
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return Promise.reject(new ApiError(400))
    }
    return Promise.resolve({ ok: true } as T)
  }
  return Promise.reject(new ApiError(404))
}
