import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { useAuth } from '@/features/auth/useAuth'
import { ApiError, apiGet, apiPost } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import { BusinessIcon, type BusinessIconName } from './BusinessIcons'
import { OpportunityForm, ProfilePanel } from './BusinessForms'
import { BusinessVerificationPanel } from './BusinessVerificationPanel'
import {
  ActivityPanel,
  EmptyState,
  InquiriesPanel,
  InquiryChart,
  ListingsPanel,
  Metric,
  PanelHeading,
  Status,
  SubmittedPanel,
  TradePanel,
  type Inquiry,
  type Listing,
  type Opportunity,
} from './BusinessDashboardPanels'
import { statusLabels } from './BusinessDashboardStatus'
import '@fontsource-variable/inter/wght.css'
import './business-dashboard.css'

type Identity = {
  kind: 'individual' | 'organization'
  id: string
  label: string
  role: string | null
  verification_status: string
  is_active_context: boolean
}

type Dashboard = {
  kind: string
  id: string
  label: string
  role: string | null
  verification_status: string
  rejection_reason: string
  can_publish: boolean
  can_edit_profile: boolean
  can_submit_verification: boolean
  can_manage_members: boolean
  can_manage_trade: boolean
  listings_total: number
  inquiries_new: number
  opportunities_total: number
}

type Member = { id: string; display_name: string; role: string; status: string }
type Profile = Record<string, string | number | boolean | null>
type Section =
  'overview' | 'profile' | 'listings' | 'inquiries' | 'trade' | 'members' | 'verification'
type NavItem = { id: Section; label: string; icon: BusinessIconName }

const memberRoles: Record<string, string> = {
  owner: 'مالک',
  admin: 'مدیر',
  manager: 'کارشناس',
  member: 'عضو',
}
const memberStatuses: Record<string, string> = {
  active: 'فعال',
  invited: 'دعوت‌شده',
  suspended: 'معلق',
  removed: 'حذف‌شده',
}

const messageFrom = (error: unknown) =>
  error instanceof ApiError ? error.message : 'ارتباط با سرویس برقرار نشد.'

async function loadListings(signal?: AbortSignal): Promise<Listing[]> {
  const results: Listing[] = []
  let page = 1
  while (true) {
    const response = await apiGet<{ results: Listing[]; count: number }>(
      `/v1/business/listings?page=${page}&page_size=50`,
      undefined,
      signal,
    )
    results.push(...response.results)
    if (!response.results.length || results.length >= response.count) break
    page += 1
  }
  return results
}

function profileChecklist(kind: string, record?: Profile) {
  if (kind === 'organization') {
    return [
      { label: 'نام رسمی شرکت', done: Boolean(String(record?.name ?? '').trim()) },
      { label: 'استان فعالیت', done: Boolean(record?.province_id) },
      {
        label: 'شماره تماس',
        done: Boolean(String(record?.phone || record?.representative_phone || '').trim()),
      },
      { label: 'راه ارتباطی ایمیلی', done: Boolean(String(record?.email ?? '').trim()) },
      { label: 'معرفی شرکت', done: Boolean(String(record?.description ?? '').trim()) },
    ]
  }
  return [
    { label: 'نام نمایشی', done: String(record?.display_name ?? '').trim().length >= 2 },
    { label: 'عنوان حرفه‌ای', done: Boolean(String(record?.professional_title ?? '').trim()) },
    { label: 'استان فعالیت', done: Boolean(record?.province_id) },
    {
      label: 'راه ارتباطی',
      done: Boolean(String(record?.public_phone || record?.public_email || '').trim()),
    },
    { label: 'معرفی کوتاه', done: Boolean(String(record?.bio ?? '').trim()) },
  ]
}

function isProfileReady(kind: string, record?: Profile) {
  if (kind === 'organization') {
    return Boolean(
      String(record?.name ?? '').trim() &&
      record?.province_id &&
      String(record?.phone || record?.representative_phone || '').trim(),
    )
  }
  return String(record?.display_name ?? '').trim().length >= 2
}

function LoadingState() {
  return (
    <div
      className="business-os bos-loading"
      dir="rtl"
      aria-busy="true"
      aria-label="در حال بارگذاری داشبورد"
    >
      <div className="bos-loading-body">
        <div className="bos-skeleton bos-skeleton-title" />
        <div className="bos-loading-metrics">
          {[0, 1, 2, 3].map((item) => (
            <div className="bos-skeleton" key={item} />
          ))}
        </div>
        <div className="bos-loading-panels">
          <div className="bos-skeleton" />
          <div className="bos-skeleton" />
        </div>
      </div>
    </div>
  )
}

export function BusinessDashboardPage() {
  const { data: user, isPending: authPending } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [error, setError] = useState('')
  const [rangeDays, setRangeDays] = useState<7 | 30>(7)
  const sectionValue = params.get('section')
  const section: Section = [
    'profile',
    'listings',
    'inquiries',
    'trade',
    'members',
    'verification',
  ].includes(sectionValue ?? '')
    ? (sectionValue as Section)
    : 'overview'
  const setSection = (next: Section) => {
    const search = new URLSearchParams(params)
    if (next === 'overview') search.delete('section')
    else search.set('section', next)
    setParams(search)
  }

  const identities = useQuery({
    queryKey: ['business', 'identities'],
    queryFn: ({ signal }) =>
      apiGet<{ identities: Identity[]; active: Identity | null }>(
        '/v1/business/identities',
        undefined,
        signal,
      ),
    enabled: Boolean(user),
  })
  const active = identities.data?.active
  const identityKey = active ? `${active.kind}:${active.id}` : 'none'
  const dashboard = useQuery({
    queryKey: ['business', 'dashboard', identityKey],
    queryFn: ({ signal }) => apiGet<Dashboard>('/v1/business/dashboard', undefined, signal),
    enabled: Boolean(user && identities.isSuccess),
  })
  const data = dashboard.data
  const hasIdentity = Boolean(
    data?.kind && active && data.kind === active.kind && data.id === active.id,
  )
  const listings = useQuery({
    queryKey: ['business', 'listings', identityKey],
    queryFn: ({ signal }) => loadListings(signal),
    enabled: hasIdentity,
  })
  const received = useQuery({
    queryKey: ['business', 'inquiries', 'received', identityKey],
    queryFn: ({ signal }) =>
      apiGet<Inquiry[]>('/v1/services/inquiries/received', undefined, signal),
    enabled: hasIdentity && listings.isSuccess,
  })
  const submitted = useQuery({
    queryKey: ['business', 'inquiries', 'submitted'],
    queryFn: ({ signal }) =>
      apiGet<Inquiry[]>('/v1/services/inquiries/submitted', undefined, signal),
    enabled: hasIdentity && section === 'inquiries',
  })
  const profile = useQuery({
    queryKey: ['business', 'profile', data?.kind, data?.id],
    queryFn: ({ signal }) =>
      apiGet<Profile>(
        data?.kind === 'organization'
          ? `/v1/business/organizations/${data.id}`
          : '/v1/business/individual',
        undefined,
        signal,
      ),
    enabled: hasIdentity,
  })
  const opportunities = useQuery({
    queryKey: ['business', 'opportunities', identityKey],
    queryFn: ({ signal }) =>
      apiGet<Opportunity[]>(
        `/v1/business/organizations/${active?.id}/opportunities`,
        undefined,
        signal,
      ),
    enabled: hasIdentity && data?.kind === 'organization' && Boolean(data.can_manage_trade),
  })
  const members = useQuery({
    queryKey: ['business', 'members', identityKey],
    queryFn: ({ signal }) =>
      apiGet<Member[]>(`/v1/business/organizations/${active?.id}/members`, undefined, signal),
    enabled: hasIdentity && Boolean(data?.can_manage_members) && section === 'members',
  })
  const scopedInquiries = useMemo(() => {
    const ids = new Set((listings.data ?? []).map((item) => item.id))
    return (received.data ?? [])
      .filter((item) => ids.has(item.listing_id))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  }, [listings.data, received.data])
  const canPublish = Boolean(
    data?.can_publish &&
    (data.kind !== 'organization' || (profile.isSuccess && profile.data?.is_active !== false)),
  )
  const nav: NavItem[] = [
    { id: 'overview', label: 'نمای مدیریتی', icon: 'grid' },
    { id: 'listings', label: 'محصولات و خدمات', icon: 'package' },
    { id: 'inquiries', label: 'درخواست‌های مشتریان', icon: 'inbox' },
    ...(data?.can_manage_trade
      ? [{ id: 'trade', label: 'فرصت‌های تجاری', icon: 'trade' } as NavItem]
      : []),
    { id: 'profile', label: 'پروفایل کسب‌وکار', icon: 'building' },
    { id: 'verification', label: 'تأیید و مدارک', icon: 'shield' },
    ...(data?.can_manage_members
      ? [{ id: 'members', label: 'اعضا و دسترسی‌ها', icon: 'users' } as NavItem]
      : []),
  ]

  const switchIdentity = useMutation({
    mutationFn: (identity: Identity) =>
      apiPost('/v1/business/identity', { kind: identity.kind, id: identity.id }),
    onSuccess: async () => {
      setError('')
      await queryClient.cancelQueries({ queryKey: ['business'] })
      queryClient.removeQueries({
        queryKey: ['business'],
        predicate: (query) => query.queryKey[1] !== 'identities',
      })
      queryClient.removeQueries({ queryKey: ['inquiries'] })
      queryClient.removeQueries({ queryKey: ['inquiry-detail'] })
      queryClient.removeQueries({ queryKey: ['inquiry-notifications'] })
      await queryClient.invalidateQueries({ queryKey: ['business', 'identities'] })
      setSection('overview')
    },
    onError: (cause) => setError(messageFrom(cause)),
  })
  const invite = useMutation({
    mutationFn: (email: string) =>
      apiPost(`/v1/business/organizations/${active?.id}/members`, { email }),
    onSuccess: async () => {
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['business', 'members', identityKey] })
    },
    onError: (cause) => setError(messageFrom(cause)),
  })
  const createOpportunity = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost(`/v1/business/organizations/${active?.id}/opportunities`, body),
    onSuccess: async () => {
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['business'] })
    },
    onError: (cause) => setError(messageFrom(cause)),
  })

  if (
    authPending ||
    (user && (identities.isLoading || dashboard.isLoading || switchIdentity.isPending))
  )
    return <LoadingState />
  if (!user) {
    return (
      <div className="business-os bos-gate" dir="rtl">
        <div className="bos-gate-card">
          <span className="bos-mark">
            <BusinessIcon name="briefcase" />
          </span>
          <span className="bos-eyebrow">فضای مدیریت کارفنسا</span>
          <h1>مرکز مدیریت کسب‌وکار</h1>
          <p>برای مدیریت هویت تجاری، محصولات و درخواست‌ها وارد حساب خود شوید.</p>
          <AppLink className="bos-primary" href="/login">
            ورود به حساب <BusinessIcon name="arrow-left" />
          </AppLink>
        </div>
      </div>
    )
  }
  if (identities.isError || dashboard.isError || !data || (active && !hasIdentity)) {
    return (
      <div className="business-os bos-gate" dir="rtl">
        <div className="bos-gate-card">
          <BusinessIcon name="warning" />
          <h1>داشبورد در دسترس نیست</h1>
          <p>{messageFrom(identities.error ?? dashboard.error)}</p>
          <button
            className="bos-primary"
            type="button"
            onClick={() => {
              void identities.refetch()
              void dashboard.refetch()
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </div>
    )
  }

  const allListings = listings.data ?? []
  const publishedProducts = allListings.filter(
    (item) => item.listing_kind === 'product' && item.status === 'approved' && item.is_active,
  ).length
  const publishedServices = allListings.filter(
    (item) => item.listing_kind === 'service' && item.status === 'approved' && item.is_active,
  ).length
  const pendingInquiries = scopedInquiries.filter(
    (item) => item.status === 'new' || item.status === 'read',
  ).length
  const publishedOpportunities = (opportunities.data ?? []).filter(
    (item) => item.is_published,
  ).length
  const checklist = profileChecklist(data.kind, profile.data)
  const completion = profile.isSuccess
    ? Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100)
    : null
  const status = statusLabels[data.verification_status] ?? 'هویت انتخاب نشده'
  const focusedSection = section === 'profile' || section === 'verification'
  const pageTitle =
    section === 'profile'
      ? 'پروفایل کسب‌وکار'
      : section === 'verification'
        ? 'تأیید و مدارک'
        : 'مرکز مدیریت کسب‌وکار'
  const pageDescription =
    section === 'profile'
      ? `اطلاعات و تصویر ${data.label || 'هویت فعال'} را مدیریت کنید.`
      : section === 'verification'
        ? `وضعیت بررسی و مدارک ${data.label || 'هویت فعال'} را دنبال کنید.`
        : `فعالیت‌ها، فرصت‌ها و عملکرد ${data.label || 'کسب‌وکار'} را دنبال کنید.`
  const publicProfilePath =
    data.kind === 'organization'
      ? profile.data?.slug
        ? `/companies/${encodeURIComponent(String(profile.data.slug))}`
        : ''
      : `/individuals/${encodeURIComponent(data.id)}`

  const identitySelector = (
    <div className="bos-identity" title="تعویض هویت فعال">
      <div className="bos-identity-avatar">
        <BusinessIcon name={active?.kind === 'organization' ? 'building' : 'user'} />
      </div>
      <div className="bos-identity-copy">
        <small>هویت فعال</small>
        <strong>{active?.label ?? 'انتخاب هویت'}</strong>
      </div>
      <BusinessIcon name="chevron-down" className="bos-identity-chevron" />
      <select
        aria-label="تعویض هویت فعال"
        value={active ? identityKey : ''}
        disabled={switchIdentity.isPending}
        onChange={(event) => {
          const next = identities.data?.identities.find(
            (item) => `${item.kind}:${item.id}` === event.target.value,
          )
          if (next && !next.is_active_context) switchIdentity.mutate(next)
        }}
      >
        {!active && <option value="">انتخاب هویت</option>}
        {(identities.data?.identities ?? []).map((item) => (
          <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
            {item.label} · {item.kind === 'organization' ? 'شرکت' : 'فردی'}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className={`business-os is-${section}-section`} dir="rtl">
      <header className="management-page-header">
        <div>
          <span className="management-page-kicker">فضای مدیریت / کسب‌وکار</span>
          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>
        <div className="bos-header-actions">
          <Status value={data.verification_status} label={status} />
          <div className="bos-identity-wrap">{identitySelector}</div>
        </div>
      </header>
      <nav className="bos-section-nav" aria-label="بخش‌های کسب‌وکار">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bos-nav-item${section === item.id ? ' is-active' : ''}`}
            aria-current={section === item.id ? 'page' : undefined}
            onClick={() => setSection(item.id)}
          >
            <BusinessIcon name={item.icon} />
            <span>{item.label}</span>
            {item.id === 'inquiries' && data.inquiries_new > 0 && (
              <em>{formatNumber(data.inquiries_new)}</em>
            )}
          </button>
        ))}
      </nav>
      <div className="bos-content" id="business-content">
        {error && (
          <div className="bos-alert" role="alert">
            <BusinessIcon name="warning" />
            {error}
            <button type="button" aria-label="بستن پیام" onClick={() => setError('')}>
              <BusinessIcon name="close" />
            </button>
          </div>
        )}
        {!data.kind ? (
          <section className="bos-panel bos-no-identity">
            <EmptyState
              icon="building"
              title="هنوز هویتی ثبت نشده"
              description="برای شروع، هویت شرکتی یا فردی خود را بسازید."
            />
            <AppLink className="bos-primary" href="/join">
              ایجاد هویت <BusinessIcon name="arrow-left" />
            </AppLink>
          </section>
        ) : (
          <>
            {section === 'overview' && (
              <>
                <div className="bos-section-title">
                  <div>
                    <span className="bos-eyebrow">نمای کلی</span>
                    <h2>
                      نمای مدیریتی <span>/ {data.label}</span>
                    </h2>
                  </div>
                  <span className="bos-live-label">
                    <i /> داده‌های فعلی حساب
                  </span>
                </div>
                <div className="bos-kpis">
                  <Metric
                    icon="package"
                    label="محصولات فعال"
                    value={listings.isSuccess ? publishedProducts : null}
                    detail="تأییدشده و در دسترس"
                  />
                  <Metric
                    icon="briefcase"
                    label="خدمات فعال"
                    value={listings.isSuccess ? publishedServices : null}
                    detail="تأییدشده و در دسترس"
                  />
                  {data.can_manage_trade && (
                    <Metric
                      icon="trade"
                      label="فرصت‌های منتشرشده"
                      value={opportunities.isSuccess ? publishedOpportunities : null}
                      detail={`${formatNumber(data.opportunities_total)} فرصت ثبت‌شده`}
                    />
                  )}
                  <Metric
                    icon="inbox"
                    label="درخواست‌های جدید"
                    value={data.inquiries_new}
                    detail="نیازمند بررسی"
                    highlight
                  />
                  <Metric
                    icon="clock"
                    label="در انتظار رسیدگی"
                    value={received.isSuccess && listings.isSuccess ? pendingInquiries : null}
                    detail="جدید یا خوانده‌شده"
                  />
                </div>
                <div className="bos-command">
                  <div>
                    <span className="bos-command-icon">
                      <BusinessIcon name="spark" />
                    </span>
                    <div>
                      <strong>اقدام سریع</strong>
                      <small>کارهای مهم را از همین‌جا آغاز کنید</small>
                    </div>
                  </div>
                  <div className="bos-command-actions">
                    {canPublish && (
                      <Link to="/services/listings/new?kind=product&next=business">
                        <BusinessIcon name="plus" /> افزودن محصول
                      </Link>
                    )}
                    {canPublish && (
                      <Link to="/services/listings/new?kind=service&next=business">
                        <BusinessIcon name="plus" /> افزودن خدمت
                      </Link>
                    )}
                    {data.can_manage_trade && (
                      <button type="button" onClick={() => setSection('trade')}>
                        <BusinessIcon name="trade" /> ثبت فرصت تجاری
                      </button>
                    )}
                    {data.can_edit_profile && (
                      <button type="button" onClick={() => setSection('profile')}>
                        <BusinessIcon name="edit" /> ویرایش پروفایل
                      </button>
                    )}
                    <button type="button" onClick={() => setSection('inquiries')}>
                      <BusinessIcon name="inbox" /> درخواست‌های مشتریان
                    </button>
                  </div>
                </div>
                <div className="bos-workspace">
                  <section className="bos-panel bos-activity-panel">
                    <PanelHeading
                      eyebrow="عملکرد کسب‌وکار"
                      title="فعالیت درخواست‌ها"
                      action={
                        <div className="bos-range" role="group" aria-label="بازه زمانی">
                          <button
                            type="button"
                            className={rangeDays === 7 ? 'is-active' : ''}
                            aria-pressed={rangeDays === 7}
                            onClick={() => setRangeDays(7)}
                          >
                            ۷ روز
                          </button>
                          <button
                            type="button"
                            className={rangeDays === 30 ? 'is-active' : ''}
                            aria-pressed={rangeDays === 30}
                            onClick={() => setRangeDays(30)}
                          >
                            ۳۰ روز
                          </button>
                        </div>
                      }
                    />
                    <InquiryChart
                      inquiries={scopedInquiries}
                      days={rangeDays}
                      loading={received.isLoading || listings.isLoading}
                      error={received.isError || listings.isError}
                    />
                  </section>
                  <section className="bos-panel bos-profile-panel">
                    <PanelHeading
                      eyebrow="هویت کسب‌وکار"
                      title="پروفایل کسب‌وکار"
                      action={
                        <button
                          className="bos-text-action"
                          type="button"
                          onClick={() => setSection('profile')}
                        >
                          مشاهده <BusinessIcon name="arrow-left" />
                        </button>
                      }
                    />
                    <div className="bos-profile-state">
                      <div className="bos-profile-score">
                        <strong>
                          {completion === null ? '—' : `${formatNumber(completion)}٪`}
                        </strong>
                        <span>تکمیل اطلاعات لازم</span>
                      </div>
                      <Status value={data.verification_status} />
                    </div>
                    <div
                      className="bos-progress"
                      role="progressbar"
                      aria-label="تکمیل اطلاعات لازم"
                      aria-valuenow={completion ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${completion ?? 0}%` }} />
                    </div>
                    {profile.isError ? (
                      <p className="bos-error">دریافت اطلاعات پروفایل انجام نشد.</p>
                    ) : (
                      <ul className="bos-checklist">
                        {checklist.map((item) => (
                          <li key={item.label} className={item.done ? 'is-done' : ''}>
                            <BusinessIcon name={item.done ? 'check' : 'clock'} />
                            {item.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    {data.rejection_reason && <p className="bos-error">{data.rejection_reason}</p>}
                    {publicProfilePath && (
                      <Link className="bos-inline-action" to={publicProfilePath}>
                        نمایش پروفایل عمومی <BusinessIcon name="arrow-up-left" />
                      </Link>
                    )}
                  </section>
                  <ListingsPanel
                    listings={allListings}
                    loading={listings.isLoading}
                    error={listings.isError}
                    canPublish={canPublish}
                    full={false}
                    onAll={() => setSection('listings')}
                  />
                  {data.can_manage_trade && (
                    <TradePanel
                      opportunities={opportunities.data ?? []}
                      loading={opportunities.isLoading}
                      error={opportunities.isError}
                      full={false}
                      onAll={() => setSection('trade')}
                    />
                  )}
                  <InquiriesPanel
                    inquiries={scopedInquiries}
                    loading={received.isLoading || listings.isLoading}
                    error={received.isError || listings.isError}
                    full={false}
                    onAll={() => setSection('inquiries')}
                  />
                  <ActivityPanel
                    listings={allListings}
                    inquiries={scopedInquiries}
                    loading={listings.isLoading || received.isLoading}
                  />
                </div>
              </>
            )}
            {section !== 'overview' && (
              <div className={`bos-section-title${focusedSection ? ' is-focused' : ''}`}>
                <div>
                  <span className="bos-eyebrow">بخش کسب‌وکار</span>
                  <h2>{nav.find((item) => item.id === section)?.label}</h2>
                </div>
                <button className="bos-back" type="button" onClick={() => setSection('overview')}>
                  <BusinessIcon name="chevron-right" /> بازگشت به نمای مدیریتی
                </button>
              </div>
            )}
            {section === 'profile' && (
              <div className="bos-detail-grid bos-focused-detail">
                <section className="bos-panel bos-profile-panel bos-desktop-summary">
                  <PanelHeading title="وضعیت پروفایل" />
                  <div className="bos-profile-state">
                    <div className="bos-profile-score">
                      <strong>{completion === null ? '—' : `${formatNumber(completion)}٪`}</strong>
                      <span>اطلاعات لازم</span>
                    </div>
                    <Status value={data.verification_status} />
                  </div>
                  <div className="bos-progress">
                    <span style={{ width: `${completion ?? 0}%` }} />
                  </div>
                  <ul className="bos-checklist">
                    {checklist.map((item) => (
                      <li key={item.label} className={item.done ? 'is-done' : ''}>
                        <BusinessIcon name={item.done ? 'check' : 'clock'} />
                        {item.label}
                      </li>
                    ))}
                  </ul>
                  {publicProfilePath && (
                    <Link className="bos-inline-action" to={publicProfilePath}>
                      نمایش پروفایل عمومی <BusinessIcon name="arrow-up-left" />
                    </Link>
                  )}
                </section>
                {data.can_edit_profile ? (
                  <ProfilePanel
                    key={identityKey}
                    kind={data.kind}
                    id={data.id}
                    completion={completion}
                    checklist={checklist}
                  />
                ) : (
                  <section className="bos-panel">
                    <EmptyState
                      icon="shield"
                      title="دسترسی ویرایش ندارید"
                      description="نقش فعلی شما اجازه ویرایش پروفایل را نمی‌دهد."
                    />
                  </section>
                )}
              </div>
            )}
            {section === 'verification' && (
              <div className="bos-detail-grid bos-focused-detail">
                <section className="bos-panel bos-desktop-summary">
                  <PanelHeading title="وضعیت تأیید" />
                  <Status value={data.verification_status} />
                  <p className="bos-muted">
                    وضعیت فعلی هویت {data.kind === 'organization' ? 'شرکتی' : 'فردی'} شما در فرایند
                    بررسی.
                  </p>
                  {data.rejection_reason && <p className="bos-error">{data.rejection_reason}</p>}
                  {data.verification_status === 'suspended' && (
                    <p className="bos-error">
                      این هویت تعلیق شده است و با ارسال دوباره فعال نمی‌شود.
                    </p>
                  )}
                </section>
                <BusinessVerificationPanel
                  key={identityKey}
                  kind={data.kind}
                  id={data.id}
                  canSubmit={data.can_submit_verification}
                  verificationStatus={data.verification_status}
                  rejectionReason={data.rejection_reason}
                  completion={completion}
                  profileReady={isProfileReady(data.kind, profile.data)}
                  onEditProfile={() => setSection('profile')}
                />
              </div>
            )}
            {section === 'listings' && (
              <ListingsPanel
                listings={allListings}
                loading={listings.isLoading}
                error={listings.isError}
                canPublish={canPublish}
                full
                onAll={() => setSection('listings')}
              />
            )}
            {section === 'inquiries' && (
              <div className="bos-inquiry-workspace">
                <Link className="bos-action-link" to="/account/inquiries?tab=received">
                  باز کردن مرکز درخواست‌های همکاری ←
                </Link>
                <InquiriesPanel
                  inquiries={scopedInquiries}
                  loading={received.isLoading || listings.isLoading}
                  error={received.isError || listings.isError}
                  full
                  onAll={() => setSection('inquiries')}
                />
                <SubmittedPanel
                  inquiries={submitted.data ?? []}
                  loading={submitted.isLoading}
                  error={submitted.isError}
                />
              </div>
            )}
            {section === 'trade' && data.can_manage_trade && (
              <div className="bos-detail-grid">
                <TradePanel
                  opportunities={opportunities.data ?? []}
                  loading={opportunities.isLoading}
                  error={opportunities.isError}
                  full
                  onAll={() => setSection('trade')}
                />
                <section className="bos-panel bos-form-panel">
                  <OpportunityForm
                    busy={createOpportunity.isPending}
                    onSubmit={(body) => createOpportunity.mutate(body)}
                  />
                </section>
              </div>
            )}
            {section === 'members' && data.can_manage_members && (
              <section className="bos-panel bos-members-panel">
                <PanelHeading eyebrow="تیم و دسترسی" title="اعضا و دسترسی‌ها" />
                {members.isLoading ? (
                  <div className="bos-skeleton bos-row-skeleton" />
                ) : members.isError ? (
                  <p className="bos-error">دریافت اعضا انجام نشد.</p>
                ) : members.data?.length ? (
                  <ul className="bos-row-list">
                    {members.data.map((member) => (
                      <li key={member.id}>
                        <span className="bos-row-symbol">
                          <BusinessIcon name="user" />
                        </span>
                        <span className="bos-row-main">
                          <strong>{member.display_name}</strong>
                          <small>{memberRoles[member.role] ?? member.role}</small>
                        </span>
                        <Status
                          value={member.status}
                          label={memberStatuses[member.status] ?? member.status}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon="users"
                    title="عضوی ثبت نشده"
                    description="اعضای شرکت در این بخش نمایش داده می‌شوند."
                  />
                )}
                <form
                  className="bos-invite"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const email = String(
                      new FormData(event.currentTarget).get('email') ?? '',
                    ).trim()
                    if (email) invite.mutate(email)
                    event.currentTarget.reset()
                  }}
                >
                  <label htmlFor="bos-invite-email">دعوت عضو با ایمیل</label>
                  <div>
                    <input
                      id="bos-invite-email"
                      name="email"
                      type="email"
                      required
                      dir="ltr"
                      placeholder="name@company.com"
                    />
                    <button className="bos-primary" disabled={invite.isPending}>
                      {invite.isPending ? 'در حال ارسال…' : 'ارسال دعوت'}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
