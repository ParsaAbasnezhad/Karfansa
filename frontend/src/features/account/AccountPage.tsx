import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { useToast } from '@/components/toast-context'
import { Icon } from '@/features/home/icons'
import { formatShortDate } from '@/lib/format'
import { apiPatch, apiPost, ApiError } from '@/lib/api-client'
import { useIranProvinces, useProvinceCities } from './geography'
import { useAuth, type AuthUser } from '@/features/auth/useAuth'
import './account.css'

const ticketUrl = 'mailto:info@karfansa.ir?subject=درخواست پشتیبانی کارفنسا'

function ActionCard({
  icon,
  title,
  description,
  href,
  accent = '',
}: {
  icon: string
  title: string
  description: string
  href: string
  accent?: string
}) {
  return (
    <Link className={`account-action ${accent}`} to={href}>
      <span className="account-action-icon">
        <Icon name={icon} />
      </span>
      <span className="account-action-copy">
        <b>{title}</b>
        <small>{description}</small>
      </span>
      <Icon name="chev-l" className="account-action-arrow" />
    </Link>
  )
}

export function AccountPage() {
  const { data: user, isPending, isError, error } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [profileError, setProfileError] = useState('')
  const [provinceSelection, setProvinceSelection] = useState<string>()
  const [citySelection, setCitySelection] = useState<string>()
  const provinceId =
    provinceSelection ?? (user?.province_id ? String(user.province_id) : '')
  const cityId = citySelection ?? (user?.city_id ? String(user.city_id) : '')
  const provinces = useIranProvinces()
  const cities = useProvinceCities(provinceId)

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
      toast('اطلاعات پروفایل ذخیره شد.')
    },
    onError: (cause) => {
      setProfileError(cause instanceof Error ? cause.message : 'ذخیرهٔ اطلاعات انجام نشد.')
    },
  })

  const logout = useMutation({
    mutationFn: () => apiPost<{ message: string }>('/v1/auth/logout', {}),
    onSuccess: async () => {
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
    user.first_name.trim() &&
      user.last_name.trim() &&
      user.province_id &&
      user.city_id,
  )

  return (
    <section className="account-page" dir="rtl">
      <header className="account-welcome">
        <div className="account-welcome-copy">
          <span className="account-eyebrow">
            <span className="account-status-dot" />
            پنل اختصاصی شما
          </span>
          <h1>سلام، {fullName || 'به کارفنسا خوش آمدید'}</h1>
          <p>
            در کارفنسا به بهترین شرکت‌ها در حوزهٔ خود متصل شوید و خدمات موردنیازتان را بدون واسطه
            دریافت کنید.
          </p>
          <span className="account-start-tag">
            <Icon name="bolt" />
            آمادهٔ شروع همکاری
          </span>
          {!profileComplete && (
            <button
              className="account-complete-button"
              type="button"
              onClick={() =>
                document.getElementById('account-profile')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              تکمیل اطلاعات
              <Icon name="arrow-l" />
            </button>
          )}
        </div>
        <div className="account-welcome-art" aria-hidden="true">
          <span className="account-art-orbit" />
          <Icon name="building" />
          <span className="account-art-check">✓</span>
        </div>
      </header>

      <section className="account-summary" aria-label="خلاصه حساب کاربری">
        <div className="account-avatar">
          {fullName ? fullName.slice(0, 1) : <Icon name="user" />}
        </div>
        <div className="account-summary-name">
          <strong>{fullName || 'نام خود را تکمیل کنید'}</strong>
          <span>{user.email}</span>
          {user.province_name && user.city_name && (
            <span>
              {user.province_name}، {user.city_name}
            </span>
          )}
        </div>
        <div className="account-member-date">
          <span>عضو کارفنسا از</span>
          <strong>{formatShortDate(user.date_joined)}</strong>
        </div>
        <span className={`account-profile-state${profileComplete ? ' is-complete' : ''}`}>
          <Icon name={profileComplete ? 'bolt' : 'user'} />
          {profileComplete ? 'پروفایل تکمیل‌شده' : 'پروفایل ناقص'}
        </span>
      </section>

      <section className="account-section" aria-labelledby="account-actions-title">
        <div className="account-section-heading">
          <div>
            <span className="account-section-kicker">همکاری و خدمات</span>
            <h2 id="account-actions-title">از کجا شروع کنیم؟</h2>
          </div>
          <span>مسیرهای سریع کارفنسا</span>
        </div>
        <div className="account-actions">
          <ActionCard
            icon="building"
            title="لیست شرکت‌ها"
            description="شرکت‌های فعال در حوزه‌های مختلف را ببینید"
            href="/companies/"
          />
          <ActionCard
            icon="factory"
            title="ثبت شرکت"
            description="کسب‌وکار خود را در کارفنسا معرفی کنید"
            href="/register-company/"
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

      <div className={`account-lower-grid${profileComplete ? ' profile-complete' : ''}`}>
        {!profileComplete && (
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

        <section className="account-panel account-support" aria-labelledby="account-support-title">
          <div className="account-panel-heading">
            <span className="account-panel-icon support-icon">
              <Icon name="mail" />
            </span>
            <div>
              <h2 id="account-support-title">پشتیبانی کارفنسا</h2>
              <p>برای راهنمایی یا پیگیری درخواست با ما در ارتباط باشید.</p>
            </div>
          </div>
          <div className="account-ticket-empty">
            <span>
              <Icon name="file" />
            </span>
            <b>درخواستی ثبت نشده است</b>
            <small>برای شروع، تیکت تازه‌ای برای پشتیبانی ارسال کنید.</small>
          </div>
          <div className="account-support-actions">
            <a className="account-primary-button" href={ticketUrl}>
              <Icon name="send" />
              ثبت تیکت جدید
            </a>
            <a className="account-secondary-button" href={ticketUrl}>
              ارسال تیکت
            </a>
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
    </section>
  )
}
