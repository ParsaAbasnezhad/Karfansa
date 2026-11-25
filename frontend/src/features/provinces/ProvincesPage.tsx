import { Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import type { ProvinceDetail, ProvinceSummary } from './types'
import './provinces.css'
import './provinces-directory.css'

const IranMapPanel = lazy(() =>
  import('./IranMapPanel').then((module) => ({ default: module.IranMapPanel })),
)

const DESKTOP_QUERY = '(min-width: 768px)'

function subscribeToDesktopViewport(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mediaQuery = window.matchMedia(DESKTOP_QUERY)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

function isDesktopViewport() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(DESKTOP_QUERY).matches)
}

function normalizePersianText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa')
}

type CountResponse = { count: number }

export function ProvincesPage() {
  const showMap = useSyncExternalStore(subscribeToDesktopViewport, isDesktopViewport, () => false)
  const [search, setSearch] = useState('')
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const activeSlug = hoveredSlug ?? selectedSlug

  useEffect(() => {
    document.title = 'استان‌های ایران | کارفنسا'
  }, [])

  const provinces = useQuery({
    queryKey: ['iran-province-directory'],
    queryFn: ({ signal }) =>
      apiGet<ProvinceSummary[]>('/v1/geography/provinces/', { country: 'IR' }, signal),
  })
  const published = useMemo(
    () => provinces.data?.filter((province) => province.is_published) ?? [],
    [provinces.data],
  )
  const filtered = useMemo(() => {
    const query = normalizePersianText(search)
    if (!query) return published
    return published.filter((province) => normalizePersianText(province.name_fa).includes(query))
  }, [published, search])

  const organizations = useQuery({
    queryKey: ['province-intelligence', 'organization-count'],
    queryFn: ({ signal }) =>
      apiGet<CountResponse>('/v1/organizations/', { limit: 1, offset: 0 }, signal),
  })
  const opportunities = useQuery({
    queryKey: ['province-intelligence', 'opportunity-count'],
    queryFn: ({ signal }) =>
      apiGet<CountResponse>('/v1/trade/opportunities/', { page_size: 1 }, signal),
  })
  const selectedProvince = useQuery({
    queryKey: ['province-intelligence', 'detail', selectedSlug],
    queryFn: ({ signal }) =>
      apiGet<ProvinceDetail>(
        `/v1/geography/provinces/${encodeURIComponent(selectedSlug ?? '')}/`,
        undefined,
        signal,
      ),
    enabled: Boolean(selectedSlug),
    staleTime: 5 * 60 * 1000,
  })
  const selectedOrganizations = useQuery({
    queryKey: ['province-intelligence', 'province-organizations', selectedSlug],
    queryFn: ({ signal }) =>
      apiGet<CountResponse>(
        '/v1/organizations/',
        { province: selectedSlug ?? undefined, limit: 1, offset: 0 },
        signal,
      ),
    enabled: Boolean(selectedSlug),
    staleTime: 5 * 60 * 1000,
  })
  const selectedOpportunities = useQuery({
    queryKey: ['province-intelligence', 'province-opportunities', selectedSlug],
    queryFn: ({ signal }) =>
      apiGet<CountResponse>(
        '/v1/trade/opportunities/',
        { province: selectedSlug ?? undefined, page_size: 1 },
        signal,
      ),
    enabled: Boolean(selectedSlug),
    staleTime: 5 * 60 * 1000,
  })

  const selected = published.find((province) => province.slug === selectedSlug)

  return (
    <main className="provinces-page province-intelligence-page" dir="rtl">
      <header className="province-intelligence-header">
        <div className="province-intelligence-title">
          <span className="provinces-eyebrow">سامانهٔ هوشمندی جغرافیایی کارفنسا</span>
          <h1>اطلس اقتصادی استان‌های ایران</h1>
          <p>ظرفیت‌های منطقه‌ای و فرصت‌های تجاری را بر پایهٔ داده‌های ثبت‌شده بررسی کنید.</p>
        </div>
        <dl className="province-intelligence-stats" aria-label="نمای کلی داده‌های اقتصادی">
          <div className="province-intelligence-stat">
            <dt>استان‌های منتشرشده</dt>
            <dd>{provinces.isSuccess ? formatNumber(published.length) : '—'}</dd>
          </div>
          <div className="province-intelligence-stat">
            <dt>کسب‌وکارهای فعال</dt>
            <dd>{organizations.isSuccess ? formatNumber(organizations.data.count) : '—'}</dd>
          </div>
          <div className="province-intelligence-stat">
            <dt>فرصت‌های تجاری منتشرشده</dt>
            <dd>{opportunities.isSuccess ? formatNumber(opportunities.data.count) : '—'}</dd>
          </div>
        </dl>
      </header>

      {provinces.isPending ? (
        <p className="provinces-state">در حال دریافت فهرست استان‌ها…</p>
      ) : provinces.isError ? (
        <div className="provinces-state" role="alert">
          دریافت فهرست استان‌ها ممکن نشد.
          <button type="button" onClick={() => void provinces.refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : published.length ? (
        <section
          className={`iran-map-section${showMap ? ' has-map' : ' directory-only'}`}
          aria-label={showMap ? 'اطلس و فهرست استان‌های ایران' : 'فهرست استان‌های ایران'}
        >
          {showMap && (
            <Suspense fallback={<div className="iran-map-loading" aria-hidden="true" />}>
              <IranMapPanel
                provinces={published}
                hoveredSlug={hoveredSlug}
                selectedSlug={selectedSlug}
                activeSlug={activeSlug}
                selectedDetail={selectedProvince.data}
                organizationCount={
                  selectedOrganizations.isSuccess ? selectedOrganizations.data.count : undefined
                }
                opportunityCount={
                  selectedOpportunities.isSuccess ? selectedOpportunities.data.count : undefined
                }
                onHover={setHoveredSlug}
              />
            </Suspense>
          )}

          <aside className="iran-province-directory" aria-label="فهرست استان‌ها">
            <div className="iran-directory-heading">
              <span className="provinces-eyebrow">پایگاه منطقه‌ای</span>
              <h2>استان‌ها</h2>
              <p>{formatNumber(published.length)} محدودهٔ اقتصادی برای بررسی</p>
            </div>

            <label className="province-search">
              <span className="province-search-icon" aria-hidden="true">
                ⌕
              </span>
              <span className="sr-only">جست‌وجوی استان</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جست‌وجو در استان‌ها"
                autoComplete="off"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="پاک‌کردن جست‌وجو">
                  ×
                </button>
              )}
            </label>

            <nav className="iran-directory-list" aria-label="استان‌های منتشرشده">
              {filtered.map((province, index) => {
                const isActive = activeSlug === province.slug
                const isSelected = selectedSlug === province.slug
                return (
                  <div
                    className={`iran-directory-row${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                    key={province.id}
                    onPointerEnter={() => setHoveredSlug(province.slug)}
                    onPointerLeave={() => setHoveredSlug(null)}
                    onFocus={() => setHoveredSlug(province.slug)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) setHoveredSlug(null)
                    }}
                  >
                    <button
                      type="button"
                      className="iran-directory-select"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedSlug(isSelected ? null : province.slug)}
                    >
                      <span className="iran-directory-index">{formatNumber(index + 1)}</span>
                      <span className="iran-directory-pin" aria-hidden="true">
                        <svg viewBox="0 0 20 20">
                          <path d="M10 18s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" />
                          <circle cx="10" cy="8" r="2" />
                        </svg>
                      </span>
                      <strong>{province.name_fa}</strong>
                      {isSelected &&
                        selectedOrganizations.isSuccess &&
                        selectedOpportunities.isSuccess && (
                          <span
                            className="iran-directory-count"
                            aria-label={`${formatNumber(selectedOrganizations.data.count)} کسب‌وکار فعال، ${formatNumber(selectedOpportunities.data.count)} فرصت تجاری`}
                            title="کسب‌وکار فعال · فرصت تجاری"
                          >
                            {formatNumber(selectedOrganizations.data.count)} ·{' '}
                            {formatNumber(selectedOpportunities.data.count)}
                          </span>
                      )}
                    </button>
                    <Link
                      className="iran-directory-link"
                      to={`/provinces/${province.slug}/`}
                      aria-label={`مشاهدهٔ صفحهٔ ${province.name_fa}`}
                    >
                      <span aria-hidden="true">←</span>
                    </Link>
                  </div>
                )
              })}
              {!filtered.length && (
                <p className="province-search-empty">استانی با این نام پیدا نشد.</p>
              )}
            </nav>

            {selected && (
              <div className="province-selected-summary" aria-live="polite">
                <strong>{selected.name_fa}</strong>
                <div>
                  <span>
                    کسب‌وکار فعال:{' '}
                    {selectedOrganizations.isSuccess
                      ? formatNumber(selectedOrganizations.data.count)
                      : '—'}
                  </span>
                  <span>
                    فرصت تجاری:{' '}
                    {selectedOpportunities.isSuccess
                      ? formatNumber(selectedOpportunities.data.count)
                      : '—'}
                  </span>
                  {selectedProvince.isSuccess && (
                    <span>
                      شاخص اقتصادی ثبت‌شده: {formatNumber(selectedProvince.data.statistics.length)}
                    </span>
                  )}
                </div>
                <Link to={`/provinces/${selected.slug}/`}>مشاهدهٔ شناسنامهٔ استان ←</Link>
              </div>
            )}
          </aside>
        </section>
      ) : (
        <p className="provinces-state">هنوز استان منتشرشده‌ای در دسترس نیست.</p>
      )}
    </main>
  )
}
