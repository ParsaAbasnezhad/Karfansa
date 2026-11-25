import { Suspense, lazy, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import { useQuery } from '@tanstack/react-query'
import { EconomicStatistics } from './EconomicStatistics'
import type { ProvinceDetail } from './types'
import './provinces.css'
import './province-detail.css'

const ProvinceShape = lazy(() =>
  import('./ProvinceShape').then((module) => ({ default: module.ProvinceShape })),
)

/* ---------- small helpers ---------- */

const ICONS = {
  pin: (
    <>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  area: (
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  doc: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </>
  ),
  chart: <path d="M12 20V10M18 20V4M6 20v-4" />,
  factory: <path d="M2 21h20M4 21V11l6 4v-4l6 4V5h4v16" />,
  city: (
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
  ),
  map: <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  chevron: <path d="M15 18l-6-6 6-6" />,
} as const

type IconName = keyof typeof ICONS

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="province-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long' }).format(
    new Date(value),
  )
}

function formatCoordinate(value: string | null) {
  return value === null ? null : formatNumber(Number(value))
}

function Stat({ label, value, icon }: { label: string; value: string | null; icon?: IconName }) {
  return (
    <div className="province-stat">
      <span className="province-stat-label">
        {icon && <Icon name={icon} />}
        {label}
      </span>
      <strong>{value ?? 'ثبت نشده'}</strong>
    </div>
  )
}

/* ---------- page ---------- */

export function ProvinceDetailPage() {
  const { slug = '' } = useParams()
  const province = useQuery({
    queryKey: ['province-detail', slug],
    queryFn: ({ signal }) =>
      apiGet<ProvinceDetail>(`/v1/geography/provinces/${slug}/`, undefined, signal),
    enabled: Boolean(slug),
  })

  useEffect(() => {
    document.title = province.data
      ? `${province.data.name_fa} | استان‌های ایران | کارفنسا`
      : 'استان‌ها | کارفنسا'
  }, [province.data])

  if (province.isPending) {
    return <div className="provinces-page provinces-state">در حال دریافت معرفی استان…</div>
  }
  if (province.isError || !province.data) {
    return (
      <div className="provinces-page">
        <div className="provinces-state" role="alert">
          معرفی استان دریافت نشد یا هنوز منتشر نشده است.
          <Link to="/provinces/">بازگشت به فهرست استان‌ها</Link>
        </div>
      </div>
    )
  }

  const data = province.data
  const companyCount = new Set(
    data.industries.flatMap((item) => item.companies.map((company) => company.slug)),
  ).size

  const sections = [
    data.description && { href: '#province-about', label: 'معرفی استان', icon: 'info' as const },
    data.economic_description && {
      href: '#province-economy',
      label: 'اقتصاد استان',
      icon: 'chart' as const,
    },
    { href: '#province-statistics', label: 'آمار و نمودار', icon: 'chart' as const },
    { href: '#province-industries', label: 'صنایع و ظرفیت‌ها', icon: 'factory' as const },
    { href: '#province-cities', label: 'شهرها و نقشه', icon: 'city' as const },
  ].filter(Boolean) as { href: string; label: string; icon: IconName }[]

  return (
    <div className="provinces-page province-detail" dir="rtl">
      <header className="province-detail-hero">
        {data.featured_image && (
          <img className="province-featured-image" src={data.featured_image} alt="" />
        )}
        <div className="province-detail-hero-copy">
          <nav className="province-breadcrumb" aria-label="مسیر صفحه">
            <Link to="/">صفحهٔ اصلی</Link>
            <span aria-hidden="true">/</span>
            <Link to="/provinces/">استان‌های ایران</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{data.name_fa}</span>
          </nav>
          <h1>{data.name_fa}</h1>
          {data.name_en && <span className="province-name-en">{data.name_en}</span>}
          <p>
            {data.short_description || `اطلاعات جغرافیایی، اقتصادی و شهری استان ${data.name_fa}`}
          </p>
          <div className="province-detail-meta">
            {data.capital && (
              <span>
                <Icon name="pin" />
                مرکز استان: {data.capital.name_fa}
              </span>
            )}
            {data.area_sq_km && (
              <span>
                <Icon name="area" />
                مساحت: {formatNumber(Number(data.area_sq_km))} km²
              </span>
            )}
            {data.population !== null && (
              <span>
                <Icon name="users" />
                جمعیت: {formatNumber(data.population)}
              </span>
            )}
          </div>
        </div>
        <div className="province-capital">
          <div className="province-capital-text">
            <span>مرکز استان</span>
            <strong>
              {data.capital?.name_fa ?? 'ثبت نشده'}
              <Icon name="pin" />
            </strong>
            {data.capital?.name_en && <small>{data.capital.name_en}</small>}
          </div>
          <Suspense fallback={null}>
            <ProvinceShape slug={data.slug} />
          </Suspense>
        </div>
      </header>

      <nav className="province-quicknav" aria-label="بخش‌های صفحه">
        {sections.map((item) => (
          <a key={item.href} href={item.href}>
            <Icon name={item.icon} />
            {item.label}
          </a>
        ))}
      </nav>

      <div className="province-summary">
        <section className="province-content-card province-overview">
          <div className="province-section-heading">
            <span className="province-heading-icon">
              <Icon name="doc" />
            </span>
            <h2>شناسنامهٔ استان</h2>
          </div>
          <div className="province-overview-body">
            <div className="province-overview-shape">
              <Suspense fallback={null}>
                <ProvinceShape slug={data.slug} />
              </Suspense>
            </div>
            <div className="province-overview-grid">
              <Stat label="نام فارسی" value={data.name_fa} icon="doc" />
              <Stat label="نام انگلیسی" value={data.name_en || null} icon="globe" />
              <Stat label="مرکز استان" value={data.capital?.name_fa ?? null} icon="pin" />
              <Stat
                label="جمعیت"
                value={data.population !== null ? formatNumber(data.population) : null}
                icon="users"
              />
              <Stat label="عرض جغرافیایی" value={formatCoordinate(data.latitude)} icon="globe" />
              <Stat label="طول جغرافیایی" value={formatCoordinate(data.longitude)} icon="globe" />
              <Stat
                label="مساحت"
                value={
                  data.area_sq_km ? `${formatNumber(Number(data.area_sq_km))} کیلومتر مربع` : null
                }
                icon="area"
              />
              <Stat label="آخرین به‌روزرسانی" value={formatDate(data.updated_at)} icon="calendar" />
            </div>
          </div>
        </section>

        <aside className="province-economy-card" aria-label="خلاصهٔ ظرفیت اقتصادی">
          <div className="province-section-heading">
            <span className="province-heading-icon">
              <Icon name="chart" />
            </span>
            <h2>ظرفیت اقتصادی استان</h2>
          </div>
          <dl className="province-economy-figures">
            <div>
              <Icon name="factory" />
              <dt>صنعت ثبت‌شده</dt>
              <dd>{formatNumber(data.industries.length)}</dd>
            </div>
            <div>
              <Icon name="city" />
              <dt>شهر</dt>
              <dd>{formatNumber(data.cities.length)}</dd>
            </div>
            <div>
              <Icon name="users" />
              <dt>شرکت فعال</dt>
              <dd>{formatNumber(companyCount)}</dd>
            </div>
          </dl>
          {data.economic_description && <p>{data.economic_description}</p>}
          <a className="province-economy-link" href="#province-statistics">
            <Icon name="chevron" />
            مشاهدهٔ آمار و جزئیات
          </a>
        </aside>
      </div>

      <div className="province-pair">
        {data.description && (
          <section className="province-content-card" id="province-about">
            <div className="province-section-heading">
              <span className="province-heading-icon">
                <Icon name="info" />
              </span>
              <h2>دربارهٔ {data.name_fa}</h2>
            </div>
            <p>{data.description}</p>
          </section>
        )}
        {data.economic_description && (
          <section className="province-content-card" id="province-economy">
            <div className="province-section-heading">
              <span className="province-heading-icon">
                <Icon name="chart" />
              </span>
              <h2>اقتصاد استان</h2>
            </div>
            <p>{data.economic_description}</p>
          </section>
        )}
      </div>

      <div id="province-statistics">
        <EconomicStatistics
          provinceSlug={data.slug}
          provinceName={data.name_fa}
          statistics={data.statistics}
        />
      </div>

      <section className="province-industries" id="province-industries" aria-labelledby="province-industries-title">
        <div className="province-cities-heading">
          <div>
            <h2 id="province-industries-title">صنایع و ظرفیت‌های تولیدی</h2>
            <p className="province-heading-sub">مزیت‌های محلی و تولیدی استان {data.name_fa}</p>
          </div>
          <Link to="/industries/">
            <Icon name="chevron" />
            فهرست صنایع
          </Link>
        </div>
        {data.industries.length ? (
          <div className="province-industry-grid">
            {data.industries.map((item) => {
              const category = (
                <span className="province-industry-category">
                  {item.category_display || 'دسته‌بندی ثبت نشده'}
                </span>
              )
              return (
                <article className="province-industry-card" key={item.id}>
                  {item.image && (
                    <div className="province-industry-media">
                      <img
                        className="province-industry-image"
                        src={item.image}
                        alt={item.industry_name_fa}
                        loading="lazy"
                      />
                      {category}
                    </div>
                  )}
                  <div className="province-industry-body">
                    <div className="province-industry-heading">
                      {!item.image && category}
                      <h3>{item.industry_name_fa}</h3>
                      {item.industry_name_en && (
                        <span className="province-industry-en">{item.industry_name_en}</span>
                      )}
                    </div>
                    <p>
                      {item.description || item.industry_description || 'توضیحات ثبت نشده است.'}
                    </p>
                    <dl className="province-industry-facts">
                      <div>
                        <dt>سطح فعالیت</dt>
                        <dd>{item.activity_level_display || 'ثبت نشده'}</dd>
                      </div>
                      <div>
                        <dt>ظرفیت تولید</dt>
                        <dd>
                          {item.production_capacity !== null
                            ? `${formatNumber(Number(item.production_capacity))} ${item.production_capacity_unit}`
                            : 'ثبت نشده'}
                        </dd>
                      </div>
                      <div>
                        <dt>آخرین به‌روزرسانی</dt>
                        <dd>
                          {item.updated_year !== null ? formatNumber(item.updated_year) : 'ثبت نشده'}
                        </dd>
                      </div>
                    </dl>
                    {item.competitive_advantage && (
                      <div className="province-industry-advantage">
                        <strong>مزیت استان</strong>
                        <p>{item.competitive_advantage}</p>
                      </div>
                    )}
                    {item.active_cities.length > 0 && (
                      <div className="province-industry-tags">
                        <strong>شهرهای فعال</strong>
                        <ul>
                          {item.active_cities.map((city) => (
                            <li key={city.id}>
                              {city.name_fa}
                              {city.name_en && <small>{city.name_en}</small>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.products.length > 0 && (
                      <div className="province-industry-tags">
                        <strong>محصولات مرتبط</strong>
                        <ul>
                          {item.products.map((product) => (
                            <li className="province-tag-detail" key={product.id}>
                              <strong>{product.name_fa}</strong>
                              {product.name_en && <span>{product.name_en}</span>}
                              {product.description && <small>{product.description}</small>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.companies.length > 0 && (
                      <div className="province-industry-tags">
                        <strong>شرکت‌های فعال</strong>
                        <ul>
                          {item.companies.map((company) => (
                            <li key={company.slug}>
                              <Link to={`/companies/${encodeURIComponent(company.slug)}`}>
                                {company.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(item.source || item.source_url) && (
                      <footer className="province-industry-source">
                        <span>{item.source}</span>
                        {item.source_url && (
                          <a href={item.source_url} target="_blank" rel="noreferrer">
                            مشاهدهٔ منبع
                          </a>
                        )}
                      </footer>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="province-muted">
            هنوز اطلاعات مستند و منتشرشده‌ای دربارهٔ صنایع این استان ثبت نشده است.
          </p>
        )}
      </section>

      <div className={`province-geo${data.map_image ? ' has-map' : ''}`} id="province-cities">
        {data.map_image && (
          <figure className="province-content-card province-map">
            <div className="province-section-heading">
              <span className="province-heading-icon">
                <Icon name="map" />
              </span>
              <h2>نقشهٔ استان</h2>
            </div>
            <img src={data.map_image} alt={`نقشهٔ استان ${data.name_fa}`} loading="lazy" />
            <figcaption>نقشهٔ استان {data.name_fa}</figcaption>
          </figure>
        )}

        <section className="province-content-card">
          <div className="province-cities-heading">
            <div>
              <h2>شهرهای استان {data.name_fa}</h2>
            </div>
            <span>{formatNumber(data.cities.length)} شهر</span>
          </div>
          {data.cities.length ? (
            <ul className="province-city-list">
              {data.cities.map((city) => (
                <li key={city.id}>
                  <div className="province-city-name">
                    <strong>{city.name_fa}</strong>
                    {city.name_en && <span>{city.name_en}</span>}
                  </div>
                  <div className="province-city-badges">
                    {city.id === data.capital?.id && (
                      <span className="province-city-capital">مرکز استان</span>
                    )}
                    {city.is_county_center && city.id !== data.capital?.id && (
                      <span>مرکز شهرستان</span>
                    )}
                  </div>
                  {city.description && (
                    <p className="province-city-description">{city.description}</p>
                  )}
                  <dl className="province-city-facts">
                    <div>
                      <dt>جمعیت</dt>
                      <dd>{city.population !== null ? formatNumber(city.population) : 'ثبت نشده'}</dd>
                    </div>
                    <div>
                      <dt>مختصات</dt>
                      <dd>
                        {city.latitude !== null && city.longitude !== null
                          ? `${formatCoordinate(city.latitude)}، ${formatCoordinate(city.longitude)}`
                          : 'ثبت نشده'}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="province-muted">اطلاعات شهرهای این استان ثبت نشده است.</p>
          )}
        </section>
      </div>
    </div>
  )
}
