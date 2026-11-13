import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { useProvinceCities } from '@/features/account/geography'
import { useAuth } from '@/features/auth/useAuth'
import { ApiError, apiGet, apiPost } from '@/lib/api-client'
import { formatNumber, formatShortDate } from '@/lib/format'
import { TradeCtaArt, TradeEmptyArt, TradeHeroArt, TradeTypeIcon } from './TradeArt'
import type {
  TradeOpportunity,
  TradeOpportunitySearchPage,
  TradeOpportunitySubmission,
  TradeOptions,
  TradeOpportunityType,
} from './types'
import './trade.css'

type Filters = {
  province: string
  city: string
  product: string
  category: string
  opportunity_type: string
  q: string
  ordering: string
  status: string
  date_from: string
  date_to: string
  has_contact: boolean
}

const initialFilters: Filters = {
  province: '',
  city: '',
  product: '',
  category: '',
  opportunity_type: '',
  q: '',
  ordering: 'relevance',
  status: 'active',
  date_from: '',
  date_to: '',
  has_contact: false,
}

const searchSuggestions = [
  'نیاز به خرید گندم',
  'خریدار عمده خرما',
  'فرصت صادرات محصولات کشاورزی',
  'سرمایه‌گذاری در صنعت فولاد',
]

function formatPersianDate(value: string | null) {
  return value ? formatShortDate(value) : 'تاریخ ثبت نشده'
}

function OpportunityCard({
  item,
}: {
  item: TradeOpportunity & {
    match_score: number
    has_verified_contact: boolean
  }
}) {
  return (
    <article className="trade-opportunity-card">
      <div className="trade-card-topline">
        <span className={`trade-type-badge trade-type-${item.opportunity_type}`}>
          <TradeTypeIcon type={item.opportunity_type} />
          {item.opportunity_type_display}
        </span>
        {item.has_verified_contact && (
          <span className="trade-contact-badge">راه ارتباطی تأییدشده</span>
        )}
        <Link className="trade-province" to={`/provinces/${item.province_slug}/`}>
          <span aria-hidden="true">⌖</span>
          {item.province_name_fa}
          {item.city_name_fa && `، ${item.city_name_fa}`}
        </Link>
      </div>
      <h2>{item.title}</h2>
      <p className="trade-description">{item.description}</p>
      {((item.product_name_fa && !item.service_listing_slug) || item.industry_name_fa) && (
        <div className="trade-taxonomy">
          {item.product_name_fa && !item.service_listing_slug && (
            <span>
              <small>محصول</small>
              {item.product_name_fa}
            </span>
          )}
          {item.industry_name_fa && (
            <span>
              <small>صنعت</small>
              {item.industry_name_fa}
            </span>
          )}
        </div>
      )}
      <dl className="trade-opportunity-facts">
        {item.target_market && (
          <div className="trade-market-fact">
            <dt>کشور یا بازار هدف</dt>
            <dd>{item.target_market}</dd>
          </div>
        )}
        {item.required_volume !== null && (
          <div>
            <dt>حجم / ظرفیت موردنیاز</dt>
            <dd>
              {formatNumber(Number(item.required_volume))} {item.volume_unit}
            </dd>
          </div>
        )}
        {item.min_value !== null && item.max_value !== null && (
          <div>
            <dt>محدودهٔ ارزش اعلام‌شده</dt>
            <dd>
              {formatNumber(Number(item.min_value))} تا {formatNumber(Number(item.max_value))}{' '}
              {item.currency}
            </dd>
          </div>
        )}
        {item.company && (
          <div>
            <dt>شرکت مرتبط</dt>
            <dd>{item.company.name}</dd>
          </div>
        )}
      </dl>
      <footer className="trade-card-footer">
        <span className="trade-match-score">امتیاز ارتباط: {formatNumber(item.match_score)}</span>
        <div className="trade-card-dates">
          <span>انتشار: {formatPersianDate(item.published_at)}</span>
          <span>
            {item.valid_until
              ? `اعتبار تا ${formatShortDate(item.valid_until)}`
              : 'بدون تاریخ انقضای اعلام‌شده'}
          </span>
        </div>
        <div className="trade-card-source">
          {item.service_listing_slug && (
            <Link to={`/services/listings/${encodeURIComponent(item.service_listing_slug)}`}>
              مشاهدهٔ محصول در بازار محصولات <span aria-hidden="true">↗</span>
            </Link>
          )}
          <span>
            {item.last_reviewed_at
              ? `آخرین بررسی: ${formatPersianDate(item.last_reviewed_at)}`
              : 'بررسی مدیر ثبت نشده'}
          </span>
          {item.source_url ? (
            <a href={item.source_url} target="_blank" rel="noreferrer">
              {item.source || 'مشاهدهٔ منبع'} <span aria-hidden="true">↗</span>
            </a>
          ) : item.source ? (
            <span>منبع: {item.source}</span>
          ) : null}
        </div>
      </footer>
    </article>
  )
}

function SubmissionForm({
  options,
  onSubmit,
  isPending,
  error,
  submitted,
}: {
  options: TradeOptions
  onSubmit: (data: TradeOpportunitySubmission) => void
  isPending: boolean
  error: string
  submitted: string
}) {
  const [formError, setFormError] = useState('')
  const [industrySlug, setIndustrySlug] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const cities = useProvinceCities(selectedProvince)
  const products = useMemo(
    () =>
      industrySlug
        ? options.products.filter((product) => product.industry_slugs.includes(industrySlug))
        : options.products,
    [industrySlug, options.products],
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    const form = new FormData(event.currentTarget)
    const minValue = String(form.get('min_value') ?? '').trim()
    const maxValue = String(form.get('max_value') ?? '').trim()
    const currency = String(form.get('currency') ?? '').trim()
    if (Boolean(minValue) !== Boolean(maxValue) || (minValue && !currency)) {
      setFormError('برای ثبت ارزش مالی، حداقل، حداکثر و واحد پول را کامل وارد کنید.')
      return
    }

    onSubmit({
      title: String(form.get('title') ?? '').trim(),
      province_id: Number(form.get('province_id')),
      city_id: form.get('city_id') ? Number(form.get('city_id')) : null,
      product_id: form.get('product_id') ? Number(form.get('product_id')) : null,
      industry_id: form.get('industry_id') ? Number(form.get('industry_id')) : null,
      opportunity_type: String(form.get('opportunity_type')) as TradeOpportunityType,
      description: String(form.get('description') ?? '').trim(),
      target_market: String(form.get('target_market') ?? '').trim(),
      required_volume: String(form.get('required_volume') ?? '').trim() || null,
      volume_unit: String(form.get('volume_unit') ?? '').trim(),
      min_value: minValue || null,
      max_value: maxValue || null,
      currency: currency.toUpperCase(),
      company_id: String(form.get('company_id') ?? '') || null,
      source: String(form.get('source') ?? '').trim(),
      source_url: String(form.get('source_url') ?? '').trim(),
      valid_until: String(form.get('valid_until') ?? '') || null,
    })
  }

  return (
    <form className="trade-submission-form" onSubmit={submit}>
      <div className="trade-form-grid">
        <label className="trade-form-wide">
          عنوان فرصت
          <input name="title" maxLength={250} required placeholder="مثلاً تأمین خرمای صادراتی" />
        </label>
        <label>
          نوع فرصت
          <select name="opportunity_type" required defaultValue="">
            <option value="" disabled>
              انتخاب کنید
            </option>
            {options.opportunity_types.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          استان
          <select
            name="province_id"
            required
            value={selectedProvince}
            onChange={(event) => setSelectedProvince(event.target.value)}
          >
            <option value="" disabled>
              انتخاب کنید
            </option>
            {options.provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name_fa}
              </option>
            ))}
          </select>
        </label>
        <label>
          شهر
          <select
            key={selectedProvince}
            name="city_id"
            defaultValue=""
            disabled={!selectedProvince}
          >
            <option value="">بدون انتخاب</option>
            {(cities.data ?? []).map((city) => (
              <option key={city.id} value={city.id}>
                {city.name_fa}
              </option>
            ))}
          </select>
        </label>
        <label>
          صنعت مرتبط
          <select
            name="industry_id"
            defaultValue=""
            onChange={(event) => {
              setIndustrySlug(
                options.industries.find((industry) => String(industry.id) === event.target.value)
                  ?.slug ?? '',
              )
              setSelectedProduct('')
            }}
          >
            <option value="">بدون انتخاب</option>
            {options.industries.map((industry) => (
              <option key={industry.id} value={industry.id}>
                {industry.name_fa}
              </option>
            ))}
          </select>
        </label>
        <label>
          محصول مرتبط
          <select
            name="product_id"
            value={selectedProduct}
            onChange={(event) => setSelectedProduct(event.target.value)}
          >
            <option value="">بدون انتخاب</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name_fa}
              </option>
            ))}
          </select>
        </label>
        <label>
          بازار یا کشور هدف
          <input name="target_market" maxLength={300} placeholder="کشور یا بازار مقصد" />
        </label>
        <label>
          شرکت مرتبط با فرصت
          <select name="company_id" defaultValue="">
            <option value="">بدون اتصال به شرکت</option>
            {options.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          حجم یا ظرفیت موردنیاز
          <input name="required_volume" type="number" min="0" step="any" />
        </label>
        <label>
          واحد اندازه‌گیری
          <input name="volume_unit" maxLength={60} placeholder="تن، کیلوگرم، عدد و…" />
        </label>
        <label>
          حداقل ارزش مالی
          <input name="min_value" type="number" min="0" step="any" />
        </label>
        <label>
          حداکثر ارزش مالی
          <input name="max_value" type="number" min="0" step="any" />
        </label>
        <label>
          واحد پول (کد سه‌حرفی)
          <input name="currency" maxLength={3} placeholder="USD / IRR / EUR" dir="ltr" />
        </label>
        <label>
          تاریخ پایان اعتبار
          <input name="valid_until" type="date" />
        </label>
        <label className="trade-form-wide">
          توضیحات کامل
          <textarea name="description" rows={5} required minLength={10} />
        </label>
        <label>
          منبع فرصت
          <input
            name="source"
            maxLength={300}
            required
            placeholder="گزارش، فراخوان یا اطلاعات شرکت"
          />
        </label>
        <label>
          پیوند منبع
          <input name="source_url" type="url" placeholder="https://" dir="ltr" />
        </label>
      </div>
      {(formError || error) && (
        <p className="trade-form-error" role="alert">
          {formError || error}
        </p>
      )}
      {submitted && (
        <p className="trade-form-success" role="status">
          {submitted}
        </p>
      )}
      <button className="trade-submit-button" type="submit" disabled={isPending}>
        {isPending ? 'در حال ثبت…' : 'ارسال برای بررسی مدیر'}
      </button>
      <p className="trade-form-note">
        فرصت تازه تا زمان بررسی و تأیید مدیر منتشر نمی‌شود؛ اطلاعات تأییدنشده به‌عنوان فرصت واقعی
        نمایش داده نخواهد شد.
      </p>
    </form>
  )
}

export function TradeOpportunitiesPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  const [submissionMessage, setSubmissionMessage] = useState('')
  const options = useQuery({
    queryKey: ['trade-options', Boolean(auth.data)],
    queryFn: ({ signal }) => apiGet<TradeOptions>('/v1/trade/options/', undefined, signal),
  })
  const selectedProvinceId =
    options.data?.provinces.find((province) => province.slug === filters.province)?.id.toString() ??
    ''
  const cities = useProvinceCities(selectedProvinceId)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setFilters((current) => ({ ...current, q: searchInput.trim() }))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const opportunities = useQuery({
    queryKey: ['trade-opportunities-search', filters, page],
    queryFn: ({ signal }) =>
      apiGet<TradeOpportunitySearchPage>(
        '/v1/trade/opportunities/search/',
        {
          province: filters.province || undefined,
          city: filters.city || undefined,
          product: filters.product || undefined,
          category: filters.category || undefined,
          opportunity_type: filters.opportunity_type || undefined,
          q: filters.q || undefined,
          status: filters.status,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          has_contact: filters.has_contact ? 'true' : undefined,
          ordering: filters.ordering,
          page: String(page),
        },
        signal,
      ),
  })
  const submissions = useQuery({
    queryKey: ['my-trade-opportunities'],
    queryFn: ({ signal }) =>
      apiGet<TradeOpportunity[]>('/v1/trade/my-opportunities/', undefined, signal),
    enabled: Boolean(auth.data),
    retry: false,
  })
  const submitOpportunity = useMutation({
    mutationFn: (payload: TradeOpportunitySubmission) =>
      apiPost<{ id: number; slug: string; review_status: string; message: string }>(
        '/v1/trade/opportunities/',
        payload,
      ),
    onSuccess: async (result) => {
      setSubmissionError('')
      setSubmissionMessage(result.message)
      await queryClient.invalidateQueries({ queryKey: ['my-trade-opportunities'] })
    },
    onError: (cause) => {
      setSubmissionMessage('')
      setSubmissionError(cause instanceof Error ? cause.message : 'ثبت فرصت انجام نشد.')
    },
  })

  const updateFilter = (key: keyof Filters, value: string) => {
    setPage(1)
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'province' ? { city: '' } : {}),
    }))
  }
  const categories = useMemo(
    () =>
      (options.data?.industries ?? []).filter(
        (industry, index, list) =>
          list.findIndex((entry) => entry.category === industry.category) === index,
      ),
    [options.data?.industries],
  )
  const isLoggedOut = auth.error instanceof ApiError && auth.error.status === 401

  return (
    <div className="trade-page" dir="rtl">
      <header className="trade-hero">
        <div className="trade-hero-copy">
          <span>شبکهٔ فرصت‌های کارفنسا</span>
          <h1>فرصت‌های تجارت و صادرات</h1>
          <p>فرصت‌های واقعی خرید، فروش و همکاری را بر اساس اطلاعات بررسی‌شده پیدا کنید.</p>
          <div className="trade-hero-tags">
            <span>صادرات و واردات</span>
            <span>بازارهای هدف</span>
            <span>فرصت‌های تأییدشده</span>
          </div>
        </div>
        <div className="trade-hero-art">
          <TradeHeroArt />
        </div>
      </header>

      <div className="trade-discovery-layout">
        <section className="trade-filter-panel" aria-label="فیلتر و جستجوی فرصت‌ها">
          <div className="trade-filter-heading">
            <strong>فرصت مناسب کسب‌وکارتان را پیدا کنید</strong>
            <span>فقط فرصت‌های فعال و تأییدشده نمایش داده می‌شوند.</span>
          </div>
          <form
            className="trade-filters"
            onSubmit={(event) => {
              event.preventDefault()
              updateFilter('q', searchInput.trim())
            }}
          >
            <label className="trade-search">
              جست‌وجوی هوشمند
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="مثلاً نیاز به خرید ۵۰۰ تن گندم در استان فارس"
                aria-label="عبارت جست‌وجوی فرصت‌های اقتصادی"
              />
            </label>
            <div className="trade-search-suggestions" aria-label="پیشنهاد جست‌وجو">
              {searchSuggestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => setSearchInput(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
            <label>
              استان
              <select
                value={filters.province}
                onChange={(event) => updateFilter('province', event.target.value)}
              >
                <option value="">همهٔ استان‌ها</option>
                {(options.data?.provinces ?? []).map((province) => (
                  <option key={province.id} value={province.slug}>
                    {province.name_fa}
                  </option>
                ))}
              </select>
            </label>
            <label>
              شهرستان
              <select
                value={filters.city}
                onChange={(event) => updateFilter('city', event.target.value)}
                disabled={!filters.province}
              >
                <option value="">همهٔ شهرستان‌ها</option>
                {(cities.data ?? []).map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name_fa}
                  </option>
                ))}
              </select>
            </label>
            <label>
              محصول
              <select
                value={filters.product}
                onChange={(event) => updateFilter('product', event.target.value)}
              >
                <option value="">همهٔ محصولات</option>
                {(options.data?.products ?? []).map((product) => (
                  <option key={product.id} value={product.slug}>
                    {product.name_fa}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حوزه اقتصادی
              <select
                value={filters.category}
                onChange={(event) => updateFilter('category', event.target.value)}
              >
                <option value="">همهٔ حوزه‌ها</option>
                {categories.map((industry) => (
                  <option key={industry.category} value={industry.category}>
                    {industry.category_display}
                  </option>
                ))}
              </select>
            </label>
            <label>
              نوع فرصت
              <select
                value={filters.opportunity_type}
                onChange={(event) => updateFilter('opportunity_type', event.target.value)}
              >
                <option value="">همهٔ انواع</option>
                {(options.data?.opportunity_types ?? []).map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              مرتب‌سازی
              <select
                value={filters.ordering}
                onChange={(event) => updateFilter('ordering', event.target.value)}
              >
                <option value="relevance">مرتبط‌ترین</option>
                <option value="newest">جدیدترین</option>
                <option value="oldest">قدیمی‌ترین</option>
                <option value="quantity">بیشترین مقدار</option>
              </select>
            </label>
            <label>
              وضعیت فرصت
              <select
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
              >
                <option value="active">فعال</option>
                <option value="expiring">در آستانهٔ انقضا</option>
              </select>
            </label>
            <label>
              انتشار از
              <input
                type="date"
                value={filters.date_from}
                onChange={(event) => updateFilter('date_from', event.target.value)}
              />
            </label>
            <label>
              انتشار تا
              <input
                type="date"
                value={filters.date_to}
                onChange={(event) => updateFilter('date_to', event.target.value)}
              />
            </label>
            <label className="trade-contact-filter">
              <input
                type="checkbox"
                checked={filters.has_contact}
                onChange={(event) => {
                  setPage(1)
                  setFilters((current) => ({ ...current, has_contact: event.target.checked }))
                }}
              />
              راه ارتباطی تأییدشده
            </label>
            <button type="submit" className="trade-search-button">
              جستجو
            </button>
          </form>
        </section>

        <section className="trade-results" aria-label="فرصت‌های فعال">
          <div className="trade-section-heading">
            <div>
              <span>فرصت‌های بررسی‌شده</span>
              <h2>فرصت‌های فعال</h2>
            </div>
            {opportunities.data && <span>{formatNumber(opportunities.data.count)} فرصت</span>}
          </div>
          {opportunities.isPending ? (
            <p className="trade-state">در حال دریافت فرصت‌های تجاری…</p>
          ) : opportunities.isError ? (
            <div className="trade-state" role="alert">
              دریافت فرصت‌ها ممکن نشد.
              <button type="button" onClick={() => void opportunities.refetch()}>
                تلاش دوباره
              </button>
            </div>
          ) : opportunities.data.results.length ? (
            <>
              <div className="trade-opportunity-grid">
                {opportunities.data.results.map((item) => (
                  <OpportunityCard key={item.id} item={item} />
                ))}
              </div>
              {opportunities.data.total_pages > 1 && (
                <nav className="trade-pagination" aria-label="صفحه‌های فرصت‌ها">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    صفحهٔ قبل
                  </button>
                  <span>
                    صفحهٔ {formatNumber(page)} از {formatNumber(opportunities.data.total_pages)}
                  </span>
                  <button
                    type="button"
                    disabled={page >= opportunities.data.total_pages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    صفحهٔ بعد
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="trade-state">
              <TradeEmptyArt />
              فرصت فعالی با این مشخصات پیدا نشد. فیلترها را تغییر دهید یا بعداً بازگردید.
            </div>
          )}
        </section>
      </div>

      <section className="trade-submit-section" aria-labelledby="trade-submit-title">
        <div className="trade-submit-copy">
          <span>همکاری شفاف و قابل پیگیری</span>
          <h2 id="trade-submit-title">یک فرصت تجاری سراغ دارید؟</h2>
          <p>
            اطلاعات و منبع را ارسال کنید. تیم کارفنسا آن را بررسی می‌کند و تنها پس از تأیید منتشر
            خواهد شد.
          </p>
          {!auth.data && !auth.isPending && isLoggedOut && (
            <AppLink href="/login/" className="trade-login-link">
              ورود برای ثبت فرصت
            </AppLink>
          )}
          {!auth.data && !auth.isPending && auth.isError && !isLoggedOut && (
            <p className="trade-form-error" role="alert">
              وضعیت حساب دریافت نشد؛ برای ثبت فرصت، اتصال سرویس حساب را بررسی کنید.
            </p>
          )}
          {!auth.data && !auth.isPending && !auth.isError && (
            <AppLink href="/login/" className="trade-login-link">
              برای ثبت فرصت وارد حساب شوید
            </AppLink>
          )}
          {auth.isPending && <span className="trade-auth-loading">در حال بررسی حساب کاربری…</span>}
          <TradeCtaArt />
        </div>
        {auth.data && (
          <details className="trade-submission">
            <summary>ثبت فرصت جدید</summary>
            {options.isPending ? (
              <p className="trade-state">در حال دریافت گزینه‌های فرم…</p>
            ) : options.isError || !options.data ? (
              <p className="trade-form-error" role="alert">
                گزینه‌های فرم دریافت نشد. صفحه را تازه‌سازی کنید.
              </p>
            ) : (
              <SubmissionForm
                options={options.data}
                onSubmit={(payload) => {
                  setSubmissionError('')
                  setSubmissionMessage('')
                  submitOpportunity.mutate(payload)
                }}
                isPending={submitOpportunity.isPending}
                error={submissionError}
                submitted={submissionMessage}
              />
            )}
          </details>
        )}
      </section>

      {auth.data && (
        <section className="trade-my-submissions" aria-labelledby="trade-my-title">
          <div className="trade-section-heading">
            <div>
              <span>پیگیری درخواست‌ها</span>
              <h2 id="trade-my-title">فرصت‌های ثبت‌شدهٔ من</h2>
            </div>
          </div>
          {submissions.isError ? (
            <p className="trade-form-error" role="alert">
              درخواست‌های شما دریافت نشد.
            </p>
          ) : submissions.isPending ? (
            <p className="trade-state">در حال دریافت درخواست‌ها…</p>
          ) : submissions.data.length ? (
            <div className="trade-my-list">
              {submissions.data.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.province_name_fa} · {item.opportunity_type_display}
                    </span>
                  </div>
                  <span className={`trade-review-status status-${item.review_status}`}>
                    {item.review_status_display}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="trade-state">هنوز فرصتی ثبت نکرده‌اید.</p>
          )}
        </section>
      )}
    </div>
  )
}
