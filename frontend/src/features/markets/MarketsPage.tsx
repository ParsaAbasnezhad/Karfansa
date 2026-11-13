import { useEffect, useState } from 'react'
import { getMarketData } from '@/lib/market-api'
import { useQuery } from '@tanstack/react-query'
import './markets.css'

type Category = 'exchange' | 'gold' | 'oil' | 'stock'

type PricePoint = {
  value: string
  change_percent: string | null
  observed_at: string
}

type Quote = {
  category: Category
  symbol: string
  name: string
  value: string
  currency: string
  unit: string
  change_percent: string | null
  source: string
  observed_at: string
  is_featured: boolean
  history: PricePoint[]
}

type Provider = {
  name: string
  website_url: string
  rest_base_url: string
  websocket_url: string
  rest_requests_per_minute: number
  websocket_connections: number
  subscription_pricing: string
  coverage: string[]
  configured: boolean
}

type Overview = { results: Quote[]; provider: Provider }
type History = {
  category: Category
  symbol: string
  name: string
  currency: string
  unit: string
  results: PricePoint[]
}

const categoryNames: Record<Category, string> = {
  exchange: 'ارز',
  gold: 'طلا',
  oil: 'نفت و کالا',
  stock: 'بورس تهران',
}

const number = (value: string | number) =>
  Number(value).toLocaleString('fa-IR', { maximumFractionDigits: 4 })
const quoteKey = (quote: Quote) => `${quote.category}:${quote.symbol}`

function PriceChart({ points }: { points: PricePoint[] }) {
  const validPoints = points
    .map((point) => ({ ...point, numericValue: Number(point.value) }))
    .filter((point) => Number.isFinite(point.numericValue))
  if (!validPoints.length) {
    return <p className="market-empty">برای این دارایی هنوز داده تاریخی ثبت نشده است.</p>
  }

  const width = 800
  const height = 220
  const padding = 12
  const values = validPoints.map((point) => point.numericValue)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || Math.max(Math.abs(max) * 0.01, 1)
  const coordinates = validPoints.map((point, index) => ({
    x: padding + (index / Math.max(validPoints.length - 1, 1)) * (width - padding * 2),
    y: height - padding - ((point.numericValue - min) / range) * (height - padding * 2),
  }))
  const line = coordinates
    .map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')
  const first = validPoints[0]!
  const last = validPoints[validPoints.length - 1]!

  return (
    <>
      <div className="market-chart-values">
        <span>{number(first.value)}</span>
        <span>{number(last.value)}</span>
      </div>
      <svg
        className="market-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`نمودار تغییرات قیمت ${last.value}`}
      >
        <path d={`${line} L${width - padding} ${height - padding} L${padding} ${height - padding} Z`} className="market-chart-area" />
        <path d={line} className="market-chart-line" />
      </svg>
      <div className="market-chart-dates">
        <time dateTime={first.observed_at}>{new Date(first.observed_at).toLocaleString('fa-IR')}</time>
        <time dateTime={last.observed_at}>{new Date(last.observed_at).toLocaleString('fa-IR')}</time>
      </div>
    </>
  )
}

export function MarketsPage() {
  useEffect(() => {
    document.title = 'بازارها | کارفنسا'
  }, [])
  const [selectedKey, setSelectedKey] = useState('')
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['market-overview'],
    queryFn: ({ signal }) => getMarketData<Overview>('/v1/market/overview/', undefined, signal),
    refetchInterval: 60_000,
  })
  const activeQuote =
    data?.results.find((quote) => quoteKey(quote) === selectedKey) ?? data?.results[0]
  const history = useQuery({
    queryKey: ['market-history', activeQuote?.category, activeQuote?.symbol],
    queryFn: ({ signal }) =>
      getMarketData<History>(
        '/v1/market/history/',
        { category: activeQuote!.category, symbol: activeQuote!.symbol, limit: 100 },
        signal,
      ),
    enabled: Boolean(activeQuote),
  })
  const groups: Category[] = ['exchange', 'gold', 'stock', 'oil']

  return (
    <main className="markets-page" dir="rtl">
      <header className="markets-hero">
        <div>
          <span className="markets-eyebrow">داده‌های بازار</span>
          <h1>نبض بازارها</h1>
          <p>نرخ ارز، طلا، بورس تهران و کالاهای جهانی در یک نگاه</p>
        </div>
        <button type="button" onClick={() => void refetch()}>
          به‌روزرسانی
        </button>
      </header>
      {isError && (
        <div className="markets-message" role="alert">
          دریافت اطلاعات بازار ممکن نشد. <button onClick={() => void refetch()}>تلاش دوباره</button>
        </div>
      )}
      {isLoading && <div className="markets-message">در حال دریافت اطلاعات بازار…</div>}
      {data && (
        <>
          {data.results.some((quote) => quote.source === 'نمونه') && (
            <div className="markets-message" role="status">
              API بازار هنوز در دسترس نیست؛ فعلاً دادهٔ نمونه نمایش داده می‌شود.
            </div>
          )}
          <div className="markets-meta">
            آخرین دریافت از سامانه: {new Date(dataUpdatedAt).toLocaleString('fa-IR')}
          </div>
          {groups.map((category) => {
            const items = data.results.filter((quote) => quote.category === category)
            return (
              <section className="market-group" key={category}>
                <h2>
                  {categoryNames[category]} <span>{items.length} دارایی</span>
                </h2>
                {items.length ? (
                  <div className="market-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>نماد</th>
                          <th>نام دارایی</th>
                          <th>قیمت</th>
                          <th>تغییر</th>
                          <th>واحد</th>
                          <th>آخرین زمان ثبت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((quote) => (
                          <tr
                            key={quoteKey(quote)}
                            className={
                              activeQuote && quoteKey(quote) === quoteKey(activeQuote)
                                ? 'is-selected'
                                : undefined
                            }
                          >
                            <td data-label="نماد">{quote.symbol}</td>
                            <td data-label="نام دارایی">{quote.name}</td>
                            <td data-label="قیمت">
                              {number(quote.value)} {quote.currency}
                            </td>
                            <td
                              data-label="تغییر"
                              className={Number(quote.change_percent) < 0 ? 'negative' : 'positive'}
                            >
                              {quote.change_percent == null
                                ? '—'
                                : `${number(quote.change_percent)}٪`}
                            </td>
                            <td data-label="واحد">{quote.unit || '—'}</td>
                            <td data-label="آخرین زمان ثبت">
                              {new Date(quote.observed_at).toLocaleString('fa-IR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="market-empty">هنوز داده‌ای برای این بخش دریافت نشده است.</p>
                )}
              </section>
            )
          })}
          <section className="market-group market-chart-card">
            <div className="market-chart-heading">
              <div>
                <span className="markets-eyebrow">روند تاریخی</span>
                <h2>{activeQuote ? `نمودار ${activeQuote.name}` : 'نمودار قیمت'}</h2>
              </div>
              <label>
                انتخاب دارایی
                <select
                  aria-label="انتخاب دارایی برای نمودار"
                  value={activeQuote ? quoteKey(activeQuote) : ''}
                  onChange={(event) => setSelectedKey(event.target.value)}
                  disabled={!data.results.length}
                >
                  {data.results.map((quote) => (
                    <option key={quoteKey(quote)} value={quoteKey(quote)}>
                      {categoryNames[quote.category]} · {quote.name} ({quote.symbol})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {history.isError ? (
              <p className="markets-message" role="alert">دریافت تاریخچه قیمت ممکن نشد.</p>
            ) : history.isLoading ? (
              <p className="market-empty">در حال دریافت تاریخچه قیمت…</p>
            ) : (
              <PriceChart points={history.data?.results ?? activeQuote?.history ?? []} />
            )}
          </section>
          <section className="provider-card">
            <div className="provider-heading">
              <div>
                <span className="markets-eyebrow">ارائه‌دهنده داده</span>
                <h2>{data.provider.name}</h2>
              </div>
              <span className={data.provider.configured ? 'provider-status ready' : 'provider-status'}>
                {data.provider.configured ? 'تنظیم‌شده' : 'نیازمند پیکربندی'}
              </span>
            </div>
            <p>جزئیات زیر بر اساس اطلاعات ارائه‌شده درباره سرویس StreamData نمایش داده می‌شود.</p>
            <div className="provider-facts">
              <div>
                <b>REST API</b>
                <span>{data.provider.rest_requests_per_minute} درخواست در دقیقه</span>
              </div>
              <div>
                <b>WebSocket</b>
                <span>حداکثر {data.provider.websocket_connections} اتصال</span>
              </div>
              <div>
                <b>اشتراک</b>
                <span>{data.provider.subscription_pricing || 'هزینه را از ارائه‌دهنده استعلام کنید.'}</span>
              </div>
              <div>
                <b>وضعیت اتصال</b>
                <span>
                  {data.provider.configured
                    ? 'نشانی API و کلید دسترسی تنظیم شده'
                    : 'برای دریافت داده زنده باید نشانی API، مسیرهای سرویس و کلید دسترسی تنظیم شوند.'}
                </span>
              </div>
            </div>
            <h3>پوشش اعلام‌شده</h3>
            <ul>
              {data.provider.coverage.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a href={data.provider.website_url} target="_blank" rel="noreferrer">
              وب‌سایت و مستندات StreamData ↗
            </a>
          </section>
        </>
      )}
    </main>
  )
}
