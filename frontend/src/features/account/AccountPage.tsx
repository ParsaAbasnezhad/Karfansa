import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { useToast } from '@/components/toast-context'
import { Icon } from '@/features/home/icons'
import { IntentDialog } from '@/features/intents/IntentDialog'
import { formatNumber, formatShortDate } from '@/lib/format'
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api-client'
import { useIranProvinces, useProvinceCities } from './geography'
import { useAuth, type AuthUser } from '@/features/auth/useAuth'
import { statusLabels } from '@/features/business/BusinessDashboardStatus'
import { emptySummary, type TicketPage } from '@/features/support/types'
import './account.css'
import '@/features/support/support.css'

function ActionCard({
  icon,
  title,
  description,
  href,
  onClick,
  accent = '',
}: {
  icon: string
  title: string
  description: string
  href?: string
  onClick?: () => void
  accent?: string
}) {
  const contents = (
    <>
      <span className="account-action-icon">
        <Icon name={icon} />
      </span>
      <span className="account-action-copy">
        <b>{title}</b>
        <small>{description}</small>
      </span>
      <Icon name="chev-l" className="account-action-arrow" />
    </>
  )
  if (href)
    return (
      <Link className={`account-action ${accent}`} to={href}>
        {contents}
      </Link>
    )
  return (
    <button className={`account-action ${accent}`} type="button" onClick={onClick}>
      {contents}
    </button>
  )
}

type Identity = {
  kind: 'individual' | 'organization'
  id: string
  label: string
  role: string | null
  verification_status: string
  is_active_context: boolean
}

type BusinessDashboard = {
  kind: string
  id: string
  label: string
  role: string | null
  verification_status: string
  can_publish: boolean
  can_manage_trade: boolean
  listings_total: number
  inquiries_new: number
  opportunities_total: number
}

type InquiryPreview = {
  public_id: string
  target_title: string
  subject: string
  status_display: string
  created_at: string
  unread: boolean
}

type InquiryPreviewPage = { results: InquiryPreview[] }
type NotificationSummary = { unread_count: number }

function AccountMetric({
  icon,
  title,
  value,
  description,
  tone,
  loading,
}: {
  icon: string
  title: string
  value: number | undefined
  description: string
  tone: string
  loading?: boolean
}) {
  return (
    <article className={`account-metric ${tone}`}>
      <span className="account-metric-icon">
        <Icon name={icon} />
      </span>
      <div>
        <span className="account-metric-title">{title}</span>
        {loading ? (
          <span className="account-metric-value is-loading" aria-label="در حال بارگذاری" />
        ) : (
          <strong className="account-metric-value">
            {value === undefined ? '—' : formatNumber(value)}
          </strong>
        )}
        <small>{description}</small>
      </div>
    </article>
  )
}

export function AccountPage() {
  const { data: user, isPending, isError, error } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [profileError, setProfileError] = useState('')
  const [profileEditing, setProfileEditing] = useState(false)
  const [intentOpen, setIntentOpen] = useState(false)
  const [provinceSelection, setProvinceSelection] = useState<string>()
  const [citySelection, setCitySelection] = useState<string>()
  const provinceId = provinceSelection ?? (user?.province_id ? String(user.province_id) : '')
  const cityId = citySelection ?? (user?.city_id ? String(user.city_id) : '')
  const provinces = useIranProvinces()
  const cities = useProvinceCities(provinceId)
  const identities = useQuery({
    queryKey: ['business', 'identities'],
    queryFn: ({ signal }) =>
      apiGet<{ identities: Identity[]; active: Identity | null }>(
        '/v1/business/identities',
        undefined,
        signal,
      ),
    enabled: Boolean(user),
    retry: false,
  })
  const activeIdentity = identities.data?.active
  const identityKey = activeIdentity ? `${activeIdentity.kind}:${activeIdentity.id}` : 'none'
  const business = useQuery({
    queryKey: ['business', 'dashboard', identityKey],
    queryFn: ({ signal }) => apiGet<BusinessDashboard>('/v1/business/dashboard', undefined, signal),
    enabled: Boolean(user && identities.isSuccess && activeIdentity),
    retry: false,
  })
  const notifications = useQuery({
    queryKey: ['inquiry-notifications'],
    queryFn: ({ signal }) =>
      apiGet<NotificationSummary>('/v1/inquiries/notifications/list', undefined, signal),
    enabled: Boolean(user),
    staleTime: 60_000,
    retry: false,
  })
  const recentInquiries = useQuery({
    queryKey: ['account', 'recent-inquiries'],
    queryFn: ({ signal }) =>
      apiGet<InquiryPreviewPage>(
        '/v1/inquiries/received',
        { ordering: 'newest', page_size: 4 },
        signal,
      ),
    enabled: Boolean(user),
    retry: false,
  })
  const tickets = useQuery({
    queryKey: ['support-tickets', 'account-preview'],
    queryFn: ({ signal }) => apiGet<TicketPage>('/v1/support/tickets/', { page_size: 4 }, signal),
    enabled: Boolean(user),
  })
  const ticketSummary = tickets.data?.summary ?? emptySummary
  const previewTickets = tickets.data?.results ?? []

  const saveProfile = useMutation({
    mutationFn: (
      profile: Pick<AuthUser, 'first_name' | 'last_name'> & {
        province_id: number
        city_id: number
      },
    ) => apiPatch<AuthUser>('/v1/auth/me', profile),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['auth-user'], updatedUser)
      setProfileError('')
      setProfileEditing(false)
      toast('اطلاعات پروفایل ذخیره شد.')
    },
    onError: (cause) => {
      setProfileError(cause instanceof Error ? cause.message : 'ذخیرهٔ اطلاعات انجام نشد.')
    },
  })

  const logout = useMutation({
    mutationFn: () => apiPost<{ message: string }>('/v1/auth/logout', {}),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['user-intent'] })
      queryClient.removeQueries({ queryKey: ['inquiries'] })
      queryClient.removeQueries({ queryKey: ['inquiry-detail'] })
      queryClient.removeQueries({ queryKey: ['inquiry-notifications'] })
      queryClient.removeQueries({ queryKey: ['business'] })
      queryClient.removeQueries({ queryKey: ['support-tickets'] })
      queryClient.removeQueries({ queryKey: ['account'] })
      await queryClient.resetQueries({ queryKey: ['auth-user'] })
      navigate('/', { replace: true })
    },
    onError: (cause) => {
      toast(cause instanceof Error ? cause.message : 'خروج از حساب انجام نشد.')
    },
  })

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    saveProfile.mutate({
      first_name: String(form.get('first_name') ?? ''),
      last_name: String(form.get('last_name') ?? ''),
      province_id: Number(form.get('province_id')),
      city_id: Number(form.get('city_id')),
    })
  }

  if (isPending) {
    return (
      <section className="account-page" aria-label="در حال بارگذاری پنل کاربری">
        <div className="account-loading" />
        <div className="account-loading account-loading-short" />
      </section>
    )
  }

  if (!user) {
    const signedOut = error instanceof ApiError && error.status === 401
    return (
      <section className="account-page account-guard">
        <span className="account-guard-icon">
          <Icon name="user" />
        </span>
        <h1>{signedOut ? 'برای دیدن پنل وارد شوید' : 'پنل کاربری در دسترس نیست'}</h1>
        <p>
          {signedOut
            ? 'پس از ورود به حساب، می‌توانید اطلاعات و درخواست‌های خود را مدیریت کنید.'
            : isError
              ? 'ارتباط با سرویس حساب کاربری برقرار نشد. کمی بعد دوباره تلاش کنید.'
              : 'اطلاعات حساب کاربری دریافت نشد.'}
        </p>
        {signedOut && (
          <AppLink className="account-primary-button" href="/login/">
            ورود به حساب
          </AppLink>
        )}
      </section>
    )
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim()
  const profileComplete = Boolean(
    user.first_name.trim() && user.last_name.trim() && user.province_id && user.city_id,
  )
  const profileProgress =
    ([user.first_name, user.last_name, user.province_id, user.city_id].filter(Boolean).length / 4) *
    100
  const displayName = fullName || user.email
  const recentItems = recentInquiries.data?.results ?? []
  const profileInitial = fullName || user.email

  return (
    <section className="account-page" dir="rtl">
      <div className="account-workspace">
        <header className="account-topbar">
          <div className="account-page-title">
            <div>
              <span className="account-breadcrumb">فضای کاربری / حساب من</span>
              <h1>نمای کلی</h1>
            </div>
          </div>
          <div className="account-topbar-user">
            <span className="account-topbar-avatar">{profileInitial.slice(0, 1)}</span>
            <span>
              <b>{displayName}</b>
              <small>{activeIdentity?.label ?? 'حساب شخصی'}</small>
            </span>
            <Link to="/business" aria-label="مدیریت کسب‌وکار و هویت فعال">
              <Icon name="sliders" />
            </Link>
          </div>
        </header>

        <div className="account-dashboard-content">
          <header className="account-welcome">
            <div className="account-welcome-copy">
              <span className="account-eyebrow">کارفنسا · فضای کاری</span>
              <h2>خوش آمدید، {fullName || 'به کارفنسا'}</h2>
              <p>
                {activeIdentity
                  ? `در حال مدیریت ${activeIdentity.label} هستید. فعالیت‌ها و درخواست‌های خود را از اینجا دنبال کنید.`
                  : 'اطلاعات حساب و مسیرهای همکاری خود را در یک نگاه مدیریت کنید.'}
              </p>
              <div className="account-welcome-actions">
                <button
                  className="account-primary-button"
                  type="button"
                  onClick={() => navigate('/business')}
                >
                  {activeIdentity ? 'مدیریت هویت فعال' : 'انتخاب یا ثبت کسب‌وکار'}
                  <Icon name="arrow-l" />
                </button>
                {activeIdentity && (
                  <span className="account-identity-chip">
                    <Icon name={activeIdentity.kind === 'organization' ? 'building' : 'user'} />
                    {activeIdentity.label}
                    <small>{statusLabels[activeIdentity.verification_status] ?? 'هویت فعال'}</small>
                  </span>
                )}
              </div>
            </div>
            <span className="account-welcome-mark" aria-hidden="true">
              <Icon name="route" />
            </span>
          </header>

          <section className="account-metrics" aria-label="خلاصه فعالیت">
            {activeIdentity && (
              <>
                <AccountMetric
                  icon="box"
                  title="محصولات و خدمات"
                  value={business.data?.listings_total}
                  description="در هویت فعال"
                  tone="is-blue"
                  loading={business.isPending}
                />
                <AccountMetric
                  icon="mail"
                  title="درخواست‌های تازه"
                  value={business.data?.inquiries_new}
                  description="نیازمند بررسی"
                  tone="is-teal"
                  loading={business.isPending}
                />
                {business.data?.can_manage_trade && (
                  <AccountMetric
                    icon="trend"
                    title="فرصت‌های تجاری"
                    value={business.data.opportunities_total}
                    description="ثبت‌شده برای هویت فعال"
                    tone="is-violet"
                  />
                )}
              </>
            )}
            <AccountMetric
              icon="bell"
              title="اعلان‌های خوانده‌نشده"
              value={notifications.data?.unread_count}
              description="از مرکز درخواست‌ها"
              tone="is-amber"
              loading={notifications.isPending}
            />
            {activeIdentity && business.isError && (
              <p className="account-inline-error" role="alert">
                دریافت آمار کسب‌وکار ممکن نشد. <Link to="/business">رفتن به داشبورد کسب‌وکار</Link>
              </p>
            )}
            {identities.isError && (
              <p className="account-inline-error" role="alert">
                دریافت هویت‌های کسب‌وکار ممکن نشد.{' '}
                <Link to="/business">بررسی در داشبورد کسب‌وکار</Link>
              </p>
            )}
            {notifications.isError && (
              <p className="account-inline-error" role="alert">
                دریافت آمار اعلان‌ها ممکن نشد.
              </p>
            )}
          </section>

          {!activeIdentity && identities.isSuccess && (
            <section className="account-identity-empty">
              <span>
                <Icon name="building" />
              </span>
              <div>
                <h2>هویت کسب‌وکار فعالی ندارید</h2>
                <p>
                  برای مشاهده آمار محصولات و همکاری‌ها، یک هویت را در داشبورد کسب‌وکار انتخاب کنید.
                </p>
              </div>
              <Link className="account-secondary-button" to="/business">
                مشاهده کسب‌وکارها
              </Link>
            </section>
          )}

          <section
            className="account-summary"
            id="account-summary"
            aria-label="پروفایل و حساب کاربری"
          >
            <div className="account-avatar">
              {fullName ? fullName.slice(0, 1) : <Icon name="user" />}
            </div>
            <div className="account-summary-name">
              <strong>{fullName || 'نام خود را تکمیل کنید'}</strong>
              <span dir="ltr">{user.email}</span>
              {user.phone && <span dir="ltr">{user.phone}</span>}
              {user.province_name && user.city_name && (
                <span>
                  {user.province_name}، {user.city_name}
                </span>
              )}
            </div>
            <div className="account-profile-progress">
              <div>
                <span>تکمیل پروفایل</span>
                <b>{formatNumber(profileProgress)}٪</b>
              </div>
              <progress
                value={profileProgress}
                max="100"
                aria-label={`تکمیل پروفایل ${profileProgress} درصد`}
              />
            </div>
            <div className="account-member-date">
              <span>عضو از</span>
              <strong>{formatShortDate(user.date_joined)}</strong>
            </div>
            <span className={`account-profile-state${profileComplete ? ' is-complete' : ''}`}>
              <Icon name={profileComplete ? 'badge-check' : 'user'} />
              {profileComplete ? 'پروفایل تکمیل‌شده' : 'نیازمند تکمیل'}
            </span>
            <button
              className="account-profile-edit"
              type="button"
              onClick={() => {
                setProfileEditing(true)
                requestAnimationFrame(() =>
                  document
                    .getElementById('account-profile')
                    ?.scrollIntoView({ behavior: 'smooth' }),
                )
              }}
            >
              {profileComplete ? 'ویرایش اطلاعات' : 'تکمیل پروفایل'}
              <Icon name="arrow-l" />
            </button>
          </section>

          <section className="account-section" aria-labelledby="account-actions-title">
            <div className="account-section-heading">
              <div>
                <span className="account-section-kicker">دسترسی سریع</span>
                <h2 id="account-actions-title">قدم بعدی شما</h2>
              </div>
              <span>مسیرهای سریع کارفنسا</span>
            </div>
            <div className="account-actions">
              <ActionCard
                icon="compass"
                title="هدف من در کارفنسا"
                description="هدف‌های خود را ببینید و تغییر دهید"
                onClick={() => setIntentOpen(true)}
                accent="is-blue"
              />
              <ActionCard
                icon="building"
                title="داشبورد کسب‌وکار"
                description="هویت شرکت یا فعالیت فردی را مدیریت کنید"
                href="/business"
                accent="is-blue"
              />
              <ActionCard
                icon="mail"
                title="درخواست‌های همکاری"
                description="درخواست‌های دریافتی و ارسالی را پیگیری کنید"
                href="/account/inquiries"
                accent="is-blue"
              />
              {activeIdentity && business.data?.can_publish && (
                <ActionCard
                  icon="box"
                  title="افزودن محصول یا خدمت"
                  description="ثبت مورد تازه برای هویت فعال"
                  href="/services/listings/new?kind=product&next=business"
                  accent="is-blue"
                />
              )}
              {activeIdentity && business.data?.can_manage_trade && (
                <ActionCard
                  icon="trend"
                  title="فرصت‌های تجاری"
                  description="مدیریت فرصت‌های هویت فعال"
                  href="/business?section=trade"
                  accent="is-blue"
                />
              )}
              <ActionCard
                icon="building"
                title="لیست شرکت‌ها"
                description="شرکت‌های فعال در حوزه‌های مختلف را ببینید"
                href="/companies/"
              />
              <ActionCard
                icon="factory"
                title="فعالان فردی"
                description="پروفایل‌های عمومی فروشندگان و خدمات‌دهندگان مستقل"
                href="/individuals/"
              />
              <ActionCard
                icon="factory"
                title="ثبت کسب‌وکار"
                description="شرکت یا فعالیت فردی خود را در کارفنسا معرفی کنید"
                href="/join/"
                accent="is-blue"
              />
              <ActionCard
                icon="route"
                title="ثبت خدمت‌دهنده"
                description="خدمات تخصصی خود را به شرکت‌ها ارائه دهید"
                href="/transport/register/"
                accent="is-gold"
              />
            </div>
          </section>

          {(!profileComplete || profileEditing) && (
            <section
              className="account-panel"
              id="account-profile"
              aria-labelledby="account-profile-title"
            >
              <div className="account-panel-heading">
                <span className="account-panel-icon">
                  <Icon name="user" />
                </span>
                <div>
                  <h2 id="account-profile-title">اطلاعات حساب</h2>
                  <p>اطلاعات شما برای ارتباط بهتر با شرکت‌ها</p>
                </div>
              </div>
              <form className="account-profile-form" onSubmit={submitProfile}>
                <label>
                  نام
                  <input
                    name="first_name"
                    autoComplete="given-name"
                    maxLength={150}
                    defaultValue={user.first_name}
                    placeholder="نام شما"
                    required
                  />
                </label>
                <label>
                  نام خانوادگی
                  <input
                    name="last_name"
                    autoComplete="family-name"
                    maxLength={150}
                    defaultValue={user.last_name}
                    placeholder="نام خانوادگی شما"
                    required
                  />
                </label>
                <label>
                  استان محل سکونت
                  <select
                    name="province_id"
                    value={provinceId}
                    onChange={(event) => {
                      setProvinceSelection(event.target.value)
                      setCitySelection('')
                    }}
                    required
                    disabled={provinces.isPending || provinces.isError}
                  >
                    <option value="">
                      {provinces.isPending ? 'در حال دریافت استان‌ها…' : 'انتخاب استان'}
                    </option>
                    {(provinces.data ?? []).map((province) => (
                      <option key={province.id} value={province.id}>
                        {province.name_fa}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  شهر محل سکونت
                  <select
                    name="city_id"
                    value={cityId}
                    onChange={(event) => setCitySelection(event.target.value)}
                    required
                    disabled={!provinceId || cities.isPending || cities.isError}
                  >
                    <option value="">
                      {!provinceId
                        ? 'ابتدا استان را انتخاب کنید'
                        : cities.isPending
                          ? 'در حال دریافت شهرها…'
                          : 'انتخاب شهر'}
                    </option>
                    {(cities.data ?? []).map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name_fa}
                      </option>
                    ))}
                  </select>
                </label>
                {provinces.isError && (
                  <p className="account-form-error" role="alert">
                    دریافت فهرست استان‌ها ممکن نشد. صفحه را تازه‌سازی کنید.
                  </p>
                )}
                {cities.isError && (
                  <p className="account-form-error" role="alert">
                    دریافت شهرهای این استان ممکن نشد. استان را دوباره انتخاب کنید.
                  </p>
                )}
                <div className="account-readonly">
                  <span>ایمیل حساب</span>
                  <b dir="ltr">{user.email}</b>
                </div>
                {profileError && (
                  <p className="account-form-error" role="alert">
                    {profileError}
                  </p>
                )}
                <button
                  className="account-primary-button"
                  type="submit"
                  disabled={saveProfile.isPending}
                >
                  {saveProfile.isPending ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
                </button>
              </form>
            </section>
          )}

          <div className="account-lower-grid">
            <section
              className="account-panel account-activity"
              aria-labelledby="account-activity-title"
            >
              <div className="account-panel-heading">
                <span className="account-panel-icon">
                  <Icon name="trend" />
                </span>
                <div>
                  <h2 id="account-activity-title">درخواست‌های اخیر</h2>
                  <p>آخرین درخواست‌های همکاری دریافتی</p>
                </div>
                <Link className="account-panel-more" to="/account/inquiries">
                  مشاهده همه
                </Link>
              </div>
              {recentInquiries.isPending ? (
                <div className="account-activity-skeleton" aria-label="در حال دریافت درخواست‌ها">
                  <span />
                  <span />
                  <span />
                </div>
              ) : recentInquiries.isError ? (
                <div className="account-activity-state" role="alert">
                  دریافت درخواست‌ها ممکن نشد.
                  <button type="button" onClick={() => void recentInquiries.refetch()}>
                    تلاش دوباره
                  </button>
                </div>
              ) : recentItems.length === 0 ? (
                <div className="account-activity-state">
                  <Icon name="inbox" />
                  <b>درخواست تازه‌ای ندارید</b>
                  <span>با معرفی محصولات و کسب‌وکار، فرصت‌های همکاری را دنبال کنید.</span>
                </div>
              ) : (
                <div className="account-activity-list">
                  {recentItems.map((item) => (
                    <Link
                      key={item.public_id}
                      className="account-activity-row"
                      to={`/account/inquiries?tab=received&id=${item.public_id}`}
                    >
                      <span className="account-activity-icon">
                        <Icon name="mail" />
                      </span>
                      <span className="account-activity-copy">
                        <b>{item.subject}</b>
                        <small>
                          {item.target_title} · {formatShortDate(item.created_at)}
                        </small>
                      </span>
                      <span className="account-activity-status">{item.status_display}</span>
                      {item.unread && <i aria-label="خوانده‌نشده" />}
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section
              className="account-panel account-support"
              aria-labelledby="account-support-title"
            >
              <div className="account-panel-heading">
                <span className="account-panel-icon support-icon">
                  <Icon name="mail" />
                </span>
                <div>
                  <h2 id="account-support-title">پشتیبانی کارفنسا</h2>
                  <p>درخواست‌ها، پاسخ تیم پشتیبانی و وضعیت تیکت‌ها در پنل شما.</p>
                </div>
                {ticketSummary.unread > 0 && (
                  <span className="account-unread-pill" aria-label="پاسخ خوانده‌نشده">
                    {ticketSummary.unread}
                  </span>
                )}
              </div>
              {tickets.isPending ? (
                <div className="account-activity-skeleton" aria-label="در حال دریافت تیکت‌ها">
                  <span />
                  <span />
                </div>
              ) : tickets.isError ? (
                <div className="account-activity-state" role="alert">
                  دریافت درخواست‌های پشتیبانی ممکن نشد.
                  <button type="button" onClick={() => void tickets.refetch()}>
                    تلاش دوباره
                  </button>
                </div>
              ) : previewTickets.length === 0 ? (
                <div className="account-ticket-empty">
                  <span>
                    <Icon name="file" />
                  </span>
                  <b>درخواستی ثبت نشده است</b>
                  <small>برای شروع، تیکت تازه‌ای برای پشتیبانی ارسال کنید.</small>
                </div>
              ) : (
                <div>
                  {previewTickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      className="account-ticket-row"
                      to={`/account/support/${ticket.ticket_number}`}
                    >
                      <span>
                        <b>{ticket.subject}</b>
                        <small>
                          {ticket.ticket_number} · آخرین پیام{' '}
                          {formatShortDate(ticket.last_message_at ?? ticket.created_at)}
                        </small>
                      </span>
                      <span className={`account-ticket-status is-${ticket.status}`}>
                        {ticket.status_display}
                      </span>
                      {ticket.has_unread && <span className="account-unread-pill">جدید</span>}
                    </Link>
                  ))}
                </div>
              )}
              <div className="account-support-actions">
                <Link className="account-primary-button" to="/account/support?new=1">
                  <Icon name="send" />
                  ثبت تیکت جدید
                </Link>
                <Link className="account-secondary-button" to="/account/support">
                  همه درخواست‌ها
                </Link>
              </div>
            </section>
          </div>

          <footer className="account-logout-row">
            <span>برای حفظ امنیت حساب، پس از پایان کار از حساب خارج شوید.</span>
            <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <Icon name="x" />
              {logout.isPending ? 'در حال خروج…' : 'خروج از حساب'}
            </button>
          </footer>
          <IntentDialog
            open={intentOpen}
            onClose={() => setIntentOpen(false)}
            userEmail={user.email}
          />
        </div>
      </div>
    </section>
  )
}
