import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import type { ProvinceSummary, ProvinceIndustry } from './types'
import {
  IndustryAdvantageIcon,
  IndustryCategoryIcon,
  IndustryEmptyArt,
  IndustryHeroArt,
} from './IndustryArt'
import './industries.css'

const categories = [
  ['agriculture', 'کشاورزی'],
  ['food', 'صنایع غذایی'],
  ['energy', 'پتروشیمی و انرژی'],
  ['mining', 'معدن'],
  ['metals', 'صنایع فلزی'],
  ['textiles', 'نساجی و پوشاک'],
  ['chemicals', 'صنایع شیمیایی'],
  ['construction', 'ساختمان و مصالح ساختمانی'],
  ['livestock-fisheries', 'دامپروری و شیلات'],
  ['handicrafts', 'صنایع دستی'],
  ['technology', 'فناوری و صنایع دانش‌بنیان'],
]

const categorySlug = (label?: string | null) => categories.find(([, name]) => name === label)?.[0]

export function IndustriesPage() {
  const [provinceSlug, setProvinceSlug] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    document.title = 'صنایع استان‌های ایران | کارفنسا'
  }, [])

  const provinces = useQuery({
    queryKey: ['iran-province-directory'],
    queryFn: ({ signal }) =>
      apiGet<ProvinceSummary[]>('/v1/geography/provinces/', { country: 'IR' }, signal),
  })
  const industries = useQuery({
    queryKey: ['province-industries', provinceSlug, category],
    queryFn: ({ signal }) =>
      apiGet<ProvinceIndustry[]>(
        '/v1/geography/industries/',
        { province: provinceSlug || undefined, category: category || undefined },
        signal,
      ),
  })

  return (
    <main className="industries-page" dir="rtl">
      <header className="industries-hero">
        <div className="industries-hero-copy">
          <span className="industries-eyebrow">نقشهٔ تولید ایران</span>
          <h1>صنعت، مزیت رقابتی هر استان</h1>
          <p>ظرفیت‌ها، بازیگران و محصولات صنعتی را با داده‌های مستند بررسی کنید.</p>
          <div className="industries-hero-meta">
            <span>۱۱ دستهٔ صنعتی</span>
            <span>اطلاعات مبتنی بر منبع</span>
          </div>
        </div>
        <div className="industries-hero-art">
          <IndustryHeroArt />
        </div>
      </header>

      <section className="industries-filters" aria-label="فیلتر صنایع">
        <div className="industries-filter-heading">
          <span className="industries-filter-icon" aria-hidden="true">
            ⌕
          </span>
          <div>
            <strong>جست‌وجوی ظرفیت‌ها</strong>
            <span>استان و حوزهٔ موردنظرتان را انتخاب کنید</span>
          </div>
        </div>
        <div className="industries-filter-controls">
          <label>
            <span>استان</span>
            <select
              value={provinceSlug}
              onChange={(event) => setProvinceSlug(event.target.value)}
              disabled={provinces.isPending || provinces.isError}
            >
              <option value="">همهٔ استان‌ها</option>
              {(provinces.data ?? [])
                .filter((province) => province.is_published)
                .map((province) => (
                  <option key={province.id} value={province.slug}>
                    {province.name_fa}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>دسته‌بندی صنعت</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">همهٔ دسته‌ها</option>
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {(provinceSlug || category) && (
            <button
              className="industries-clear"
              type="button"
              onClick={() => {
                setProvinceSlug('')
                setCategory('')
              }}
            >
              پاک‌کردن فیلترها
            </button>
          )}
        </div>
      </section>

      {industries.isPending ? (
        <p className="industries-state">در حال دریافت اطلاعات صنایع…</p>
      ) : industries.isError ? (
        <div className="industries-state" role="alert">
          دریافت اطلاعات صنایع ممکن نشد.
          <button type="button" onClick={() => void industries.refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : industries.data.length ? (
        <section aria-label="صنایع منتشرشده استان‌ها">
          <div className="industries-results-heading">
            <div>
              <span className="industries-eyebrow">فرصت‌های صنعتی</span>
              <h2>صنایع ثبت‌شده</h2>
            </div>
            <span>{new Intl.NumberFormat('fa-IR').format(industries.data.length)} مورد</span>
          </div>
          <div className="industries-grid">
            {industries.data.map((item) => (
              <article className="industry-card" key={item.id}>
                {item.image ? (
                  <img className="industry-card-image" src={item.image} alt="" />
                ) : (
                  <div
                    className="industry-card-image industry-card-image-placeholder"
                    aria-hidden="true"
                  >
                    <span>
                      <IndustryCategoryIcon category={categorySlug(item.category_display)} />
                    </span>
                  </div>
                )}
                <div className="industry-card-body">
                  <div className="industry-card-topline">
                    <span className="industry-category">
                      {item.category_display || 'دسته‌بندی ثبت نشده'}
                    </span>
                    <Link
                      className="industry-province-link"
                      to={`/provinces/${item.province_slug}/`}
                    >
                      <span aria-hidden="true">⌖</span> {item.province_name_fa}
                    </Link>
                  </div>
                  <h2>
                    <Link to={`/provinces/${item.province_slug}/`}>{item.industry_name_fa}</Link>
                  </h2>
                  {item.industry_name_en && (
                    <span className="industry-name-en">{item.industry_name_en}</span>
                  )}
                  <p className="industry-description">
                    {item.description ||
                      item.industry_description ||
                      'توضیحات این صنعت هنوز ثبت نشده است.'}
                  </p>
                  <dl className="industry-facts">
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
                    <div className="industry-advantage">
                      <IndustryAdvantageIcon />
                      <span>مزیت رقابتی استان</span>
                      <p>{item.competitive_advantage}</p>
                    </div>
                  )}
                  {item.active_cities.length > 0 && (
                    <div className="industry-detail-group">
                      <strong>شهرهای فعال</strong>
                      <ul className="industry-tags">
                        {item.active_cities.map((city) => (
                          <li key={city.id}>{city.name_fa}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.products.length > 0 && (
                    <div className="industry-detail-group">
                      <strong>محصولات مرتبط</strong>
                      <ul className="industry-product-list">
                        {item.products.map((product) => (
                          <li key={product.id}>
                            <span>{product.name_fa}</span>
                            {product.name_en && <small>{product.name_en}</small>}
                            {product.description && <p>{product.description}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.companies.length > 0 && (
                    <div className="industry-detail-group">
                      <strong>شرکت‌های فعال</strong>
                      <ul className="industry-tags">
                        {item.companies.map((company) => (
                          <li key={company.slug}>{company.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(item.source || item.source_url) && (
                    <footer className="industry-source">
                      <div>
                        <span>منبع اطلاعات</span>
                        {item.source && <p>{item.source}</p>}
                      </div>
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noreferrer">
                          مشاهدهٔ منبع <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </footer>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="industries-state">
          <IndustryEmptyArt />
          برای این فیلتر هنوز صنعت منتشرشده‌ای ثبت نشده است.
        </div>
      )}
    </main>
  )
}
