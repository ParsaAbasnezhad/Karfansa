import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useIranProvinces, useProvinceCities } from '@/features/account/geography'
import {
  DirectoryEmpty,
  DirectoryError,
  DirectorySearch,
  DirectoryShell,
  DirectorySkeleton,
  DirectoryToolbar,
  Pagination,
  VerifiedBadge,
} from '@/features/directory/shared'
import { useDocumentTitle } from '@/features/directory/detail-shared'
import { Icon } from '@/features/home/icons'
import roadHero from '@/assets/transportation/road.webp'
import { ApiError, apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import { URLS } from '@/lib/site'
import { TRANSPORT_CATEGORY_ORDER, transportCategoryIcon, transportCategoryTitle } from './icons'
import {
  emptyTransportFilters,
  transportFilterCount,
  transportIsNarrowed,
  useTransportQueryState,
  type TransportFiltersState,
} from './filters'
import type { TransportCompanyCard, TransportCompanyPage, TransportMode } from './types'
import './transportation.css'

const PAGE_SIZE = 12

const SERVICE_OPTIONS = [
  { value: 'tracking_available', label: 'ردیابی محموله' },
  { value: 'insurance_available', label: 'بیمه بار' },
  { value: 'customs_services', label: 'خدمات گمرکی' },
] as const

const HERO_MODES = [
  { code: 'road', fallback: 'حمل جاده‌ای', hint: 'باربری و کامیونی' },
  { code: 'sea', fallback: 'حمل دریایی', hint: 'کانتینری و فله' },
  { code: 'air', fallback: 'حمل هوایی', hint: 'محموله‌های فوری' },
] as const

const HERO_POINTS = [
  'پروفایل شرکت‌های تأییدشده',
  'فیلتر بر اساس مسیر و خدمات',
  'درخواست همکاری مستقیم',
]

function serviceLabel(value: string) {
  return SERVICE_OPTIONS.find((item) => item.value === value)?.label ?? value
}

function placeLabel(item: TransportCompanyCard) {
  return [item.province?.name_fa, item.city?.name_fa].filter(Boolean).join('، ')
}

function coverageLabel(item: TransportCompanyCard) {
  const labels: string[] = []
  if (item.customs_services) labels.push('گمرک')
  if (item.tracking_available) labels.push('ردیابی')
  if (item.insurance_available) labels.push('بیمه')
  return labels
}

function CompanyCard({ item }: { item: TransportCompanyCard }) {
  const primary = item.transport_types[0]
  const fallback = transportCategoryIcon(primary?.code || 'multimodal')
  const [coverFailed, setCoverFailed] = useState(false)
  const place = placeLabel(item)
  const services = coverageLabel(item)

  return (
    <Link className="tx-card" to={`/transportation/companies/${encodeURIComponent(item.slug)}`}>
      <div className="tx-card-cover">
        {item.cover_image && !coverFailed ? (
          <img
            className="cover"
            src={item.cover_image}
            alt=""
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <img className="fallback" src={fallback} alt="" />
        )}
        <span className="tx-card-logo" aria-hidden="true">
          {item.logo ? <img src={item.logo} alt="" /> : item.name.slice(0, 1)}
        </span>
      </div>
      <div className="tx-card-body">
        <div className="tx-chips">
          {primary && <span className="dir-chip">{primary.name_fa}</span>}
          <VerifiedBadge show={item.is_verified} />
        </div>
        <h2>{item.name}</h2>
        <p>{item.description || 'معرفی کوتاهی برای این شرکت ثبت نشده است.'}</p>
        <p className="dir-identity-place">
          <Icon name="pin" />
          <span>{place || 'محل فعالیت ثبت نشده'}</span>
        </p>
        {services.length > 0 && (
          <div className="tx-chips">
            {services.map((label) => (
              <span className="dir-chip" key={label}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="tx-card-foot">
        <span>مشاهده پروفایل شرکت</span>
        <Icon name="chev-l" />
      </div>
    </Link>
  )
}

function TransportFiltersForm({
  title,
  state,
  onSubmit,
  onClear,
}: {
  title: string
  state: TransportFiltersState
  onSubmit: (next: TransportFiltersState) => void
  onClear: () => void
}) {
  return (
    <TransportFiltersFormFields
      key={`${state.province}-${state.city}-${state.coverage}-${state.verified}-${state.service}-${state.ordering}`}
      title={title}
      state={state}
      onSubmit={onSubmit}
      onClear={onClear}
    />
  )
}

function TransportFiltersFormFields({
  title,
  state,
  onSubmit,
  onClear,
}: {
  title: string
  state: TransportFiltersState
  onSubmit: (next: TransportFiltersState) => void
  onClear: () => void
}) {
  const provinces = useIranProvinces()
  const [draft, setDraft] = useState(state)
  const cities = useProvinceCities(draft.province)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit({ ...draft, page: 1 })
  }

  return (
    <form className="dir-filters" onSubmit={submit}>
      <div className="dir-filters-head">
        <h2>{title}</h2>
        <p>نتایج را بر اساس مسیر، خدمات و اعتبار محدود کنید.</p>
      </div>
      <fieldset>
        <legend>موقعیت</legend>
        <label>
          استان
          <select
            value={draft.province}
            className={draft.province ? 'is-set' : undefined}
            onChange={(event) => setDraft({ ...draft, province: event.target.value, city: '' })}
          >
            <option value="">همه استان‌ها</option>
            {(Array.isArray(provinces.data) ? provinces.data : []).map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name_fa}
              </option>
            ))}
          </select>
        </label>
        <label>
          شهر
          <select
            value={draft.city}
            disabled={!draft.province}
            className={draft.city ? 'is-set' : undefined}
            onChange={(event) => setDraft({ ...draft, city: event.target.value })}
          >
            <option value="">{draft.province ? 'همه شهرها' : 'ابتدا استان را انتخاب کنید'}</option>
            {(Array.isArray(cities.data) ? cities.data : []).map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name_fa}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>پوشش و خدمات</legend>
        <label>
          پوشش فعالیت
          <select
            value={draft.coverage}
            className={draft.coverage ? 'is-set' : undefined}
            onChange={(event) => setDraft({ ...draft, coverage: event.target.value })}
          >
            <option value="">داخلی و بین‌المللی</option>
            <option value="domestic">داخلی</option>
            <option value="international">بین‌المللی</option>
          </select>
        </label>
        <label>
          خدمات
          <select
            value={draft.service}
            className={draft.service ? 'is-set' : undefined}
            onChange={(event) => setDraft({ ...draft, service: event.target.value })}
          >
            <option value="">همه خدمات</option>
            {SERVICE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          وضعیت اعتبار
          <select
            value={draft.verified}
            className={draft.verified ? 'is-set' : undefined}
            onChange={(event) => setDraft({ ...draft, verified: event.target.value })}
          >
            <option value="">همه شرکت‌ها</option>
            <option value="true">فقط تأییدشده</option>
          </select>
        </label>
        <label>
          ترتیب نمایش
          <select
            value={draft.ordering}
            onChange={(event) => setDraft({ ...draft, ordering: event.target.value })}
          >
            <option value="">نام شرکت</option>
            <option value="newest">تازه‌ترین</option>
          </select>
        </label>
      </fieldset>
      <div className="dir-filters-actions">
        <button className="dir-button" type="submit">
          اعمال فیلترها
        </button>
        <button className="dir-text-button" type="button" onClick={onClear}>
          بازنشانی
        </button>
      </div>
    </form>
  )
}

export function TransportationCompaniesPage() {
  const { state, write } = useTransportQueryState()
  const [mobileOpen, setMobileOpen] = useState(false)
  useDocumentTitle(undefined, 'شرکت‌های حمل‌ونقل | کارفنسا')

  const modes = useQuery({
    queryKey: ['transport-modes'],
    queryFn: ({ signal }) =>
      apiGet<TransportMode[]>('/v1/transport-companies/transport-types/', undefined, signal),
  })
  const query = useQuery({
    queryKey: ['transport-companies', state],
    queryFn: ({ signal }) =>
      apiGet<TransportCompanyPage>(
        '/v1/transport-companies/',
        {
          search: state.q || undefined,
          transport_type: state.type || undefined,
          province: state.province || undefined,
          city: state.city || undefined,
          coverage: state.coverage || undefined,
          is_verified: state.verified === 'true' ? true : undefined,
          tracking_available: state.service === 'tracking_available' ? true : undefined,
          insurance_available: state.service === 'insurance_available' ? true : undefined,
          customs_services: state.service === 'customs_services' ? true : undefined,
          ordering: state.ordering || undefined,
          limit: PAGE_SIZE,
          offset: (state.page - 1) * PAGE_SIZE,
        },
        signal,
      ),
  })

  const totalPages = query.data ? Math.max(Math.ceil(query.data.count / PAGE_SIZE), 1) : 1
  const narrowed = transportIsNarrowed(state)
  const clearAll = () => {
    write(emptyTransportFilters)
    setMobileOpen(false)
  }

  const modeByCode = new Map((modes.data ?? []).map((item) => [item.code, item]))
  const categories = TRANSPORT_CATEGORY_ORDER.map((code) => modeByCode.get(code)).filter(
    (item): item is TransportMode => Boolean(item),
  )

  const provinces = useIranProvinces()
  const cities = useProvinceCities(state.province)
  const provinceName = (Array.isArray(provinces.data) ? provinces.data : []).find(
    (item) => String(item.id) === state.province,
  )?.name_fa
  const cityName = (Array.isArray(cities.data) ? cities.data : []).find(
    (item) => String(item.id) === state.city,
  )?.name_fa

  const chips: Array<{ key: string; label: string; clear: Partial<TransportFiltersState> }> = []
  if (state.q) chips.push({ key: 'q', label: `جست‌وجو: ${state.q}`, clear: { q: '' } })
  if (state.type) {
    chips.push({
      key: 'type',
      label: transportCategoryTitle(state.type, modeByCode.get(state.type)?.name_fa),
      clear: { type: '' },
    })
  }
  if (state.province)
    chips.push({
      key: 'province',
      label: provinceName || 'استان',
      clear: { province: '', city: '' },
    })
  if (state.city) chips.push({ key: 'city', label: cityName || 'شهر', clear: { city: '' } })
  if (state.coverage === 'domestic')
    chips.push({ key: 'coverage', label: 'داخلی', clear: { coverage: '' } })
  if (state.coverage === 'international')
    chips.push({ key: 'coverage', label: 'بین‌المللی', clear: { coverage: '' } })
  if (state.service)
    chips.push({ key: 'service', label: serviceLabel(state.service), clear: { service: '' } })
  if (state.verified === 'true')
    chips.push({ key: 'verified', label: 'فقط تأییدشده', clear: { verified: '' } })

  const onHeroSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    write({ ...state, q, page: 1 })
    document.getElementById('tx-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filters = (
    <TransportFiltersForm
      title="پالایش شرکت‌های حمل‌ونقل"
      state={state}
      onSubmit={(next) => {
        write(next)
        setMobileOpen(false)
      }}
      onClear={clearAll}
    />
  )

  return (
    <section className="tx-page dir-page" dir="rtl">
      <header className="tx-hero">
        <div className="tx-hero-bg" aria-hidden="true">
          <img className="tx-hero-image" src={roadHero} alt="" />
          <svg
            className="tx-routes"
            viewBox="0 0 800 340"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
          >
            <path
              className="route"
              pathLength={1}
              d="M30 250 C200 60, 380 300, 770 80"
              stroke="rgba(242,140,40,.5)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              className="route r2"
              pathLength={1}
              d="M60 90 C260 210, 460 40, 760 250"
              stroke="rgba(255,255,255,.32)"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <g className="node" fill="#f28c28">
              <circle cx="770" cy="80" r="4" />
              <circle cx="760" cy="250" r="4" />
              <circle cx="30" cy="250" r="3" />
              <circle cx="60" cy="90" r="3" />
            </g>
          </svg>
        </div>

        <div className="tx-hero-copy">
          <p className="tx-kicker">دایرکتوری لجستیک کارفنسا</p>
          <h1>شبکه شرکت‌های حمل‌ونقل و لجستیک</h1>
          <p>
            شرکت‌های معتبر حمل‌ونقل، باربری و خدمات لجستیکی را کشف کنید و همکاری‌های تجاری جدید
            بسازید.
          </p>
          <form className="tx-hero-search" role="search" onSubmit={onHeroSearch}>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              key={state.q}
              name="q"
              type="search"
              defaultValue={state.q}
              placeholder="نام شرکت حمل‌ونقل را جست‌وجو کنید"
              aria-label="جست‌وجوی شرکت حمل‌ونقل"
              autoComplete="off"
            />
            <button type="submit">جست‌وجو</button>
          </form>
          <div className="tx-hero-actions">
            <Link className="dir-button is-ghost" to={URLS.registerTransport}>
              ثبت شرکت حمل‌ونقل
            </Link>
          </div>
          <ul className="tx-hero-points">
            {HERO_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <aside className="tx-hero-panel" aria-hidden="true">
          {HERO_MODES.map((mode) => (
            <div className="tx-mode" key={mode.code}>
              <img src={transportCategoryIcon(mode.code)} alt="" />
              <div>
                <strong>{transportCategoryTitle(mode.code, mode.fallback)}</strong>
                <span>{mode.hint}</span>
              </div>
            </div>
          ))}
        </aside>
      </header>

      <div className="tx-section-head">
        <h2>دسته‌بندی بر اساس نوع حمل</h2>
        {state.type && (
          <button
            className="dir-text-button"
            type="button"
            onClick={() => write({ ...state, type: '', page: 1 })}
          >
            نمایش همه دسته‌ها
          </button>
        )}
      </div>

      <div className="tx-cats" role="listbox" aria-label="دسته‌بندی حمل‌ونقل">
        {categories.map((item) => (
          <button
            key={item.code}
            type="button"
            role="option"
            aria-selected={state.type === item.code}
            className={state.type === item.code ? 'tx-cat is-active' : 'tx-cat'}
            onClick={() =>
              write({
                ...state,
                type: state.type === item.code ? '' : item.code,
                page: 1,
              })
            }
          >
            <img src={transportCategoryIcon(item.code)} alt="" width={52} height={52} />
            <strong>{item.name_fa}</strong>
            <span>{formatNumber(item.company_count ?? 0)} شرکت</span>
          </button>
        ))}
      </div>

      <DirectoryShell
        filters={filters}
        mobileOpen={mobileOpen}
        filterCount={transportFilterCount(state)}
        onOpenFilters={() => setMobileOpen(true)}
        onCloseFilters={() => setMobileOpen(false)}
      >
        <div id="tx-results" className={query.isFetching ? 'dir-results is-busy' : 'dir-results'}>
          <div className="tx-toolbar">
            <DirectorySearch
              value={state.q}
              busy={query.isFetching}
              placeholder="جست‌وجو با نام شرکت"
              onSearch={(q) => write({ ...state, q, page: 1 })}
            />
            <DirectoryToolbar
              busy={query.isFetching && !query.isLoading}
              label={
                query.isLoading
                  ? 'در حال بارگذاری شرکت‌ها…'
                  : `${formatNumber(query.data?.count ?? 0)} شرکت`
              }
              action={
                <select
                  aria-label="مرتب‌سازی"
                  value={state.ordering}
                  onChange={(event) => write({ ...state, ordering: event.target.value, page: 1 })}
                >
                  <option value="">مرتب‌سازی بر اساس نام</option>
                  <option value="newest">تازه‌ترین</option>
                </select>
              }
            />
          </div>
          {chips.length > 0 && (
            <div className="dir-active" aria-label="فیلترهای فعال">
              <ul>
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      onClick={() => write({ ...state, ...chip.clear, page: 1 })}
                    >
                      <span>{chip.label}</span>
                      <Icon name="x" />
                      <span className="dir-sr">حذف این فیلتر</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button className="dir-text-button" type="button" onClick={clearAll}>
                پاک کردن همه
              </button>
            </div>
          )}
          {query.isLoading ? (
            <DirectorySkeleton variant="cards" />
          ) : query.isError ? (
            <DirectoryError
              title="فهرست شرکت‌های حمل‌ونقل در دسترس نیست"
              message={
                query.error instanceof ApiError
                  ? query.error.message
                  : 'ارتباط با سرور برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.'
              }
              onRetry={() => void query.refetch()}
            />
          ) : !query.data?.items.length ? (
            <DirectoryEmpty
              title={
                narrowed
                  ? 'شرکتی با این مشخصات پیدا نشد'
                  : 'هنوز شرکت حمل‌ونقلی در فهرست عمومی نیست'
              }
              body={
                narrowed
                  ? 'عبارت جست‌وجو یا فیلترهای فعال را تغییر دهید تا نتایج بیشتری نمایش داده شوند.'
                  : 'به‌محض تأیید و انتشار پروفایل شرکت‌های حمل‌ونقل، این صفحه آن‌ها را نشان می‌دهد.'
              }
              action={
                <Link className="dir-button" to={URLS.registerTransport}>
                  ثبت شرکت حمل‌ونقل
                </Link>
              }
            />
          ) : (
            <div className="tx-grid">
              {query.data.items.map((item) => (
                <CompanyCard key={item.id} item={item} />
              ))}
            </div>
          )}
          <Pagination
            page={state.page}
            totalPages={totalPages}
            onChange={(page) => write({ ...state, page })}
          />
        </div>
      </DirectoryShell>

      <aside className="tx-band">
        <div>
          <h2>شرکت حمل‌ونقل دارید؟</h2>
          <p>
            پروفایل شرکت خود را در دایرکتوری کارفنسا ثبت کنید تا صاحبان بار و همکاران تجاری شما را
            پیدا کنند.
          </p>
        </div>
        <Link className="dir-button" to={URLS.registerTransport}>
          ثبت شرکت حمل‌ونقل
        </Link>
      </aside>
    </section>
  )
}
