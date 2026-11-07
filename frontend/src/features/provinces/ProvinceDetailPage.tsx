import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import { useQuery } from '@tanstack/react-query'
import type { ProvinceDetail } from './types'
import './provinces.css'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long' }).format(
    new Date(value),
  )
}

function formatCoordinate(value: string | null) {
  return value === null ? null : formatNumber(Number(value))
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="province-stat">
      <span className="province-stat-label">{label}</span>
      <strong>{value ?? 'ثبت نشده'}</strong>
    </div>
  )
}

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
    return <main className="provinces-page provinces-state">در حال دریافت معرفی استان…</main>
  }
  if (province.isError || !province.data) {
    return (
      <main className="provinces-page">
        <div className="provinces-state" role="alert">
          معرفی استان دریافت نشد یا هنوز منتشر نشده است.
          <Link to="/provinces/">بازگشت به فهرست استان‌ها</Link>
        </div>
      </main>
    )
  }

  const data = province.data
  const location =
    data.latitude !== null && data.longitude !== null
      ? `${formatCoordinate(data.latitude)}، ${formatCoordinate(data.longitude)}`
      : null

  return (
    <main className="provinces-page province-detail" dir="rtl">
      <nav className="province-breadcrumb" aria-label="مسیر صفحه">
        <Link to="/">صفحهٔ اصلی</Link>
        <span aria-hidden="true">/</span>
        <Link to="/provinces/">استان‌های ایران</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{data.name_fa}</span>
      </nav>
      <header className="province-detail-hero">
        {data.featured_image && (
          <img className="province-featured-image" src={data.featured_image} alt="" />
        )}
        <div className="province-detail-hero-copy">
          <span className="provinces-eyebrow">پروندهٔ استان</span>
          <h1>{data.name_fa}</h1>
          {data.name_en && <span className="province-name-en">{data.name_en}</span>}
          <p>
            {data.short_description || `اطلاعات جغرافیایی، اقتصادی و شهری استان ${data.name_fa}`}
          </p>
          <div className="province-detail-meta">
            <span>به‌روزرسانی: {formatDate(data.updated_at)}</span>
            <span>شناسه: {data.slug}</span>
          </div>
        </div>
        <div className="province-capital">
          <span>مرکز استان</span>
          <strong>{data.capital?.name_fa ?? 'ثبت نشده'}</strong>
          {data.capital?.name_en && <small>{data.capital.name_en}</small>}
        </div>
      </header>

      <section className="province-stats" aria-label="اطلاعات آماری استان">
        <Stat
          label="مساحت"
          value={data.area_sq_km ? `${formatNumber(Number(data.area_sq_km))} کیلومتر مربع` : null}
        />
        <Stat
          label="جمعیت"
          value={data.population !== null ? formatNumber(data.population) : null}
        />
        <Stat label="موقعیت جغرافیایی" value={location} />
        <Stat label="مرکز استان" value={data.capital?.name_fa ?? null} />
      </section>

      <section className="province-content-card province-overview">
        <div className="province-section-heading">
          <span className="provinces-eyebrow">شناسه و جغرافیا</span>
          <h2>شناسنامهٔ استان</h2>
        </div>
        <div className="province-overview-grid">
          <Stat label="نام فارسی" value={data.name_fa} />
          <Stat label="نام انگلیسی" value={data.name_en || null} />
          <Stat label="نامک" value={data.slug} />
          <Stat label="وضعیت انتشار" value={data.is_published ? 'منتشرشده' : 'پیش‌نویس'} />
          <Stat label="عرض جغرافیایی" value={formatCoordinate(data.latitude)} />
          <Stat label="طول جغرافیایی" value={formatCoordinate(data.longitude)} />
          <Stat label="تاریخ ایجاد" value={formatDate(data.created_at)} />
          <Stat label="آخرین ویرایش" value={formatDate(data.updated_at)} />
        </div>
      </section>

      {data.description && (
        <section className="province-content-card">
          <div className="province-section-heading">
            <span className="provinces-eyebrow">چشم‌انداز استان</span>
            <h2>دربارهٔ {data.name_fa}</h2>
          </div>
          <p>{data.description}</p>
        </section>
      )}

      <section className="province-content-card province-economy">
        <div className="province-section-heading">
          <span className="provinces-eyebrow">فعالیت و تولید</span>
          <h2>اقتصاد استان</h2>
        </div>
        {data.economic_description ? (
          <p>{data.economic_description}</p>
        ) : (
          <p className="province-muted">اطلاعات اقتصادی معتبر هنوز ثبت نشده است.</p>
        )}
      </section>

      <section className="province-industries" aria-labelledby="province-industries-title">
        <div className="province-cities-heading">
          <div>
            <span className="provinces-eyebrow">تولید و مزیت‌های محلی</span>
            <h2 id="province-industries-title">صنایع و ظرفیت‌های تولیدی</h2>
          </div>
          <Link to="/industries/">فهرست صنایع</Link>
        </div>
        {data.industries.length ? (
          <div className="province-industry-grid">
            {data.industries.map((item) => (
              <article className="province-industry-card" key={item.id}>
                {item.image && (
                  <img
                    className="province-industry-image"
                    src={item.image}
                    alt={item.industry_name_fa}
                  />
                )}
                <div className="province-industry-body">
                  <div className="province-industry-heading">
                    <span className="province-industry-category">
                      {item.category_display || 'دسته‌بندی ثبت نشده'}
                    </span>
                    <h3>{item.industry_name_fa}</h3>
                    {item.industry_name_en && (
                      <span className="province-industry-en">{item.industry_name_en}</span>
                    )}
                  </div>
                  <p>{item.description || item.industry_description || 'توضیحات ثبت نشده است.'}</p>
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
                          <li key={company.slug}>{company.name}</li>
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
            ))}
          </div>
        ) : (
          <p className="province-muted">
            هنوز اطلاعات مستند و منتشرشده‌ای دربارهٔ صنایع این استان ثبت نشده است.
          </p>
        )}
      </section>

      {data.map_image && (
        <figure className="province-content-card province-map">
          <div className="province-section-heading">
            <span className="provinces-eyebrow">نمای جغرافیایی</span>
            <h2>نقشهٔ استان</h2>
          </div>
          <img src={data.map_image} alt={`نقشهٔ استان ${data.name_fa}`} />
          <figcaption>نقشهٔ استان {data.name_fa}</figcaption>
        </figure>
      )}

      <section className="province-content-card">
        <div className="province-cities-heading">
          <div>
            <span className="provinces-eyebrow">تقسیمات شهری</span>
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
                    <dt>نامک</dt>
                    <dd>{city.slug}</dd>
                  </div>
                  <div>
                    <dt>مرکز شهرستان</dt>
                    <dd>{city.is_county_center ? 'بله' : 'خیر'}</dd>
                  </div>
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
    </main>
  )
}
