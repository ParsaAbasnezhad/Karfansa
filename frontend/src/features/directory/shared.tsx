import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SectionHero } from '@/components/SectionHero'
import directoryHero from '@/assets/section-heroes/directory.svg'
import { useIranProvinces, useProvinceCities } from '@/features/account/geography'
import { Icon } from '@/features/home/icons'
import { formatNumber } from '@/lib/format'
import './directory.css'

export const ORGANIZATION_TYPES = [
  { value: 'manufacturer', label: 'تولیدی' },
  { value: 'trading', label: 'بازرگانی' },
  { value: 'supplier', label: 'تأمین‌کننده' },
  { value: 'exporter', label: 'صادرکننده' },
  { value: 'importer', label: 'واردکننده' },
  { value: 'other', label: 'سایر' },
] as const

export function organizationTypeLabel(value: string) {
  return ORGANIZATION_TYPES.find((item) => item.value === value)?.label ?? value
}

export function VerifiedBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="dir-badge">
      <Icon name="badge-check" />
      تأییدشده
    </span>
  )
}

export function DirectoryMark({
  src,
  label,
  person = false,
}: {
  src: string | null
  label: string
  person?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const letter = label.trim().slice(0, 1) || 'ک'
  return (
    <span className={person ? 'dir-mark dir-mark--person' : 'dir-mark'}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{letter}</span>
      )}
    </span>
  )
}

export function DirectorySkeleton({
  count = 6,
  variant = 'plain',
}: {
  count?: number
  variant?: 'plain' | 'cards'
}) {
  if (variant === 'cards') {
    return (
      <div className="dir-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="dir-skel-card">
            <div className="dir-skel-row">
              <span className="dir-skel-mark" />
              <span className="dir-skel-copy">
                <span className="dir-skel-line is-title" />
                <span className="dir-skel-line is-short" />
              </span>
            </div>
            <span className="dir-skel-line" />
            <span className="dir-skel-line" />
            <span className="dir-skel-line is-action" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="dir-skel-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="dir-skel" />
      ))}
    </div>
  )
}

export function DirectoryEmpty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="dir-empty" role="status">
      <span className="dir-state-icon" aria-hidden="true">
        <Icon name="search" />
      </span>
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function DirectoryError({
  message,
  title = 'بارگذاری انجام نشد',
  onRetry,
}: {
  message: string
  title?: string
  onRetry?: () => void
}) {
  return (
    <div className="dir-error" role="alert">
      <span className="dir-state-icon is-alert" aria-hidden="true">
        <Icon name="alert" />
      </span>
      <strong>{title}</strong>
      <p>{message}</p>
      {onRetry && (
        <button className="dir-button" type="button" onClick={onRetry}>
          تلاش دوباره
        </button>
      )}
    </div>
  )
}

export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="dir-breadcrumb" aria-label="مسیر صفحه">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 && ' / '}
          {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
        </span>
      ))}
    </nav>
  )
}

export type DirectoryFiltersState = {
  q: string
  province: string
  city: string
  verified: string
  organization_type?: string
  industry?: string
  page: number
}

export function activeFilterCount(state: DirectoryFiltersState) {
  return [state.province, state.city, state.verified, state.organization_type, state.industry].filter(Boolean)
    .length
}

export function directoryIsNarrowed(state: DirectoryFiltersState) {
  return Boolean(state.q) || activeFilterCount(state) > 0
}

export function useDirectoryQueryState(defaults: Partial<DirectoryFiltersState> = {}) {
  const [params, setParams] = useSearchParams()
  const state = useMemo<DirectoryFiltersState>(
    () => ({
      q: params.get('q') ?? defaults.q ?? '',
      province: params.get('province') ?? defaults.province ?? '',
      city: params.get('city') ?? defaults.city ?? '',
      verified: params.get('verified') ?? defaults.verified ?? '',
      organization_type: params.get('organization_type') ?? defaults.organization_type ?? '',
      industry: params.get('industry') ?? defaults.industry ?? '',
      page: Math.max(Number(params.get('page') || 1), 1),
    }),
    [params, defaults.q, defaults.province, defaults.city, defaults.verified, defaults.organization_type, defaults.industry],
  )

  const write = (next: DirectoryFiltersState) => {
    const search = new URLSearchParams()
    if (next.q) search.set('q', next.q)
    if (next.province) search.set('province', next.province)
    if (next.city) search.set('city', next.city)
    if (next.verified) search.set('verified', next.verified)
    if (next.organization_type) search.set('organization_type', next.organization_type)
    if (next.industry) search.set('industry', next.industry)
    if (next.page > 1) search.set('page', String(next.page))
    setParams(search, { replace: false })
  }

  return { state, write, params }
}

export function DirectoryHero({
  kicker,
  title,
  subtitle,
  search,
}: {
  kicker: string
  title: string
  subtitle: string
  search: ReactNode
}) {
  return (
    <>
      <SectionHero
        eyebrow={kicker}
        title={title}
        description={subtitle}
        image={directoryHero}
        visualVariant="directory"
        className="dir-hero"
      />
      <div className="dir-search-panel">{search}</div>
    </>
  )
}

export function DirectorySearch({
  value,
  onSearch,
  placeholder,
  busy = false,
}: {
  value: string
  onSearch: (query: string) => void
  placeholder: string
  busy?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = draft.trim()
      if (next === value.trim()) return
      onSearchRef.current(next)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [draft, value])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearchRef.current(draft.trim())
  }

  return (
    <form className="dir-search" role="search" onSubmit={submit}>
      <label className="dir-search-field">
        <span className="dir-sr">جست‌وجو در فهرست</span>
        <Icon name="search" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          aria-busy={busy}
        />
        {draft && (
          <button
            className="dir-search-clear"
            type="button"
            aria-label="پاک کردن عبارت جست‌وجو"
            onClick={() => {
              setDraft('')
              onSearchRef.current('')
            }}
          >
            <Icon name="x" />
          </button>
        )}
      </label>
      <button className="dir-button dir-search-submit" type="submit" aria-busy={busy}>
        جست‌وجو
      </button>
    </form>
  )
}

export function DirectoryActiveFilters({
  state,
  industries = [],
  showType = false,
  onChange,
  onClear,
}: {
  state: DirectoryFiltersState
  industries?: Array<{ slug: string; name_fa: string }>
  showType?: boolean
  onChange: (next: DirectoryFiltersState) => void
  onClear: () => void
}) {
  const provinces = useIranProvinces()
  const cities = useProvinceCities(state.province)
  const provinceName =
    (Array.isArray(provinces.data) ? provinces.data : []).find((item) => String(item.id) === state.province)
      ?.name_fa ?? (state.province ? 'استان انتخاب‌شده' : '')
  const cityName =
    (Array.isArray(cities.data) ? cities.data : []).find((item) => String(item.id) === state.city)?.name_fa ??
    (state.city ? 'شهر انتخاب‌شده' : '')
  const industryName = industries.find((item) => item.slug === state.industry)?.name_fa

  const chips: Array<{ key: string; label: string; clear: Partial<DirectoryFiltersState> }> = []
  if (state.q) chips.push({ key: 'q', label: `جست‌وجو: ${state.q}`, clear: { q: '' } })
  if (state.province) {
    chips.push({ key: 'province', label: provinceName, clear: { province: '', city: '' } })
  }
  if (state.city) chips.push({ key: 'city', label: cityName, clear: { city: '' } })
  if (showType && state.organization_type) {
    chips.push({
      key: 'type',
      label: organizationTypeLabel(state.organization_type),
      clear: { organization_type: '' },
    })
  }
  if (showType && state.industry) {
    chips.push({ key: 'industry', label: industryName || 'صنعت انتخاب‌شده', clear: { industry: '' } })
  }
  if (state.verified === 'true') chips.push({ key: 'verified', label: 'فقط تأییدشده', clear: { verified: '' } })

  if (!chips.length) return null

  return (
    <div className="dir-active" aria-label="فیلترهای فعال">
      <ul>
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              onClick={() => onChange({ ...state, ...chip.clear, page: 1 })}
            >
              <span>{chip.label}</span>
              <Icon name="x" />
              <span className="dir-sr">حذف این فیلتر</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="dir-text-button" type="button" onClick={onClear}>
        پاک کردن همه
      </button>
    </div>
  )
}

export function DirectoryFiltersForm({
  title,
  state,
  onSubmit,
  onClear,
  showType = false,
  industries = [],
}: {
  title: string
  state: DirectoryFiltersState
  onSubmit: (next: DirectoryFiltersState) => void
  onClear: () => void
  showType?: boolean
  industries?: Array<{ slug: string; name_fa: string }>
}) {
  const provinces = useIranProvinces()
  const [province, setProvince] = useState(state.province)
  const [city, setCity] = useState(state.city)
  const [organizationType, setOrganizationType] = useState(state.organization_type || '')
  const [industry, setIndustry] = useState(state.industry || '')
  const [verified, setVerified] = useState(state.verified)
  const cities = useProvinceCities(province)

  useEffect(() => {
    setProvince(state.province)
    setCity(state.city)
    setOrganizationType(state.organization_type || '')
    setIndustry(state.industry || '')
    setVerified(state.verified)
  }, [state.province, state.city, state.organization_type, state.industry, state.verified])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit({
      q: state.q,
      province,
      city,
      verified,
      organization_type: organizationType,
      industry,
      page: 1,
    })
  }

  return (
    <form className="dir-filters" onSubmit={submit}>
      <div className="dir-filters-head">
        <h2>{title}</h2>
        <p>نتایج را با موقعیت و وضعیت اعتبار محدود کنید.</p>
      </div>
      <fieldset>
        <legend>موقعیت</legend>
        <label>
          استان
          <select
            name="province"
            value={province}
            className={province ? 'is-set' : undefined}
            onChange={(event) => {
              setProvince(event.target.value)
              setCity('')
            }}
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
            name="city"
            value={city}
            className={city ? 'is-set' : undefined}
            disabled={!province}
            onChange={(event) => setCity(event.target.value)}
          >
            <option value="">{province ? 'همه شهرها' : 'ابتدا استان را انتخاب کنید'}</option>
            {(Array.isArray(cities.data) ? cities.data : []).map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name_fa}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {showType && (
        <fieldset>
          <legend>دسته‌بندی</legend>
          <label>
            نوع فعالیت
            <select
              name="organization_type"
              value={organizationType}
              className={organizationType ? 'is-set' : undefined}
              onChange={(event) => setOrganizationType(event.target.value)}
            >
              <option value="">همه انواع</option>
              {ORGANIZATION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {industries.length > 0 && (
            <label>
              صنعت
              <select
                name="industry"
                value={industry}
                className={industry ? 'is-set' : undefined}
                onChange={(event) => setIndustry(event.target.value)}
              >
                <option value="">همه صنایع</option>
                {industries.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name_fa}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
      )}
      <fieldset>
        <legend>اعتبار</legend>
        <label>
          وضعیت تأیید
          <select
            name="verified"
            value={verified}
            className={verified ? 'is-set' : undefined}
            onChange={(event) => setVerified(event.target.value)}
          >
            <option value="">همه پروفایل‌ها</option>
            <option value="true">فقط تأییدشده</option>
          </select>
        </label>
      </fieldset>
      <div className="dir-filter-actions">
        <button className="dir-button" type="submit">
          اعمال فیلتر
        </button>
        <button className="dir-button is-ghost" type="button" onClick={onClear}>
          بازنشانی
        </button>
      </div>
    </form>
  )
}

export function DirectoryShell({
  children,
  filters,
  mobileOpen,
  filterCount = 0,
  onOpenFilters,
  onCloseFilters,
}: {
  children: ReactNode
  filters: ReactNode
  mobileOpen: boolean
  filterCount?: number
  onOpenFilters: () => void
  onCloseFilters: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onCloseFilters)
  onCloseRef.current = onCloseFilters

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (media.matches) onCloseRef.current()
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  return (
    <>
      <div className="dir-mobile-filters">
        <button type="button" className="dir-button is-soft" onClick={onOpenFilters} aria-expanded={mobileOpen}>
          <Icon name="sliders" />
          فیلترها
          {filterCount > 0 && <span className="dir-count">{formatNumber(filterCount)}</span>}
        </button>
      </div>
      <div className="dir-layout">
        <aside className="dir-desktop-filters">{mobileOpen ? null : filters}</aside>
        <div className="dir-main">{children}</div>
      </div>
      {mobileOpen && (
        <div className="dir-drawer" role="presentation">
          <button className="dir-drawer-backdrop" type="button" aria-label="بستن فیلترها" onClick={onCloseFilters} />
          <div className="dir-drawer-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="dir-drawer-bar">
              <strong id={titleId}>فیلترها</strong>
              <button ref={closeRef} type="button" className="dir-icon-button" onClick={onCloseFilters} aria-label="بستن">
                <Icon name="x" />
              </button>
            </div>
            {filters}
          </div>
        </div>
      )}
    </>
  )
}

export function DirectoryToolbar({
  label,
  busy,
  action,
}: {
  label: string
  busy: boolean
  action?: ReactNode
}) {
  return (
    <div className="dir-toolbar">
      <p aria-live="polite">{busy ? 'در حال به‌روزرسانی نتایج…' : label}</p>
      {action}
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  const start = Math.max(0, Math.min(page - 3, totalPages - 5))
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index + 1)
  return (
    <nav className="dir-pagination" aria-label="صفحه‌بندی">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <Icon name="chev-r" />
        قبلی
      </button>
      <ol>
        {pages.map((item) => (
          <li key={item}>
            <button
              type="button"
              aria-label={`صفحه ${formatNumber(item)}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onChange(item)}
            >
              {formatNumber(item)}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        بعدی
        <Icon name="chev-l" />
      </button>
    </nav>
  )
}
