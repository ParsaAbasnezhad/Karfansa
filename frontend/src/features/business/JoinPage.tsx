import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { useIranProvinces, useProvinceCities } from '@/features/account/geography'
import { useAuth } from '@/features/auth/useAuth'
import { ApiError, apiPost } from '@/lib/api-client'
import './business.css'

type Step = 'account' | 'otp' | 'identity' | 'company' | 'individual' | 'done'

const empty = {
  phone: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  code: '',
}

function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'ارتباط با سرویس برقرار نشد.'
}

export function JoinPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user, isPending } = useAuth()
  const [step, setStep] = useState<Step>('account')
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [provinceId, setProvinceId] = useState('')
  const [cityId, setCityId] = useState('')
  const provinces = useIranProvinces()
  const cities = useProvinceCities(provinceId)

  useEffect(() => {
    if (user && (step === 'account' || step === 'otp')) setStep('identity')
  }, [user, step])

  const requestCode = useMutation({
    mutationFn: (payload: typeof empty) =>
      apiPost('/v1/auth/phone/otp', { phone: payload.phone, email: payload.email }),
    onSuccess: () => {
      setError('')
      setStep('otp')
    },
    onError: (cause) => setError(messageFrom(cause)),
  })

  const confirmCode = useMutation({
    mutationFn: (payload: typeof empty) =>
      apiPost('/v1/auth/phone/register', {
        phone: payload.phone,
        email: payload.email,
        password: payload.password,
        first_name: payload.first_name,
        last_name: payload.last_name,
        code: payload.code,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth-user'] })
      setError('')
      setStep('identity')
    },
    onError: (cause) => setError(messageFrom(cause)),
  })

  const createIndividual = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/v1/business/individual', body),
    onSuccess: async () => {
      await apiPost('/v1/business/individual/submit', {})
      await queryClient.invalidateQueries({ queryKey: ['business'] })
      setStep('done')
    },
    onError: (cause) => setError(messageFrom(cause)),
  })

  const createCompany = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const created = await apiPost<{ id: string }>('/v1/business/organizations', body)
      await apiPost(`/v1/business/organizations/${created.id}/submit`, {})
      return created
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['business'] })
      setStep('done')
    },
    onError: (cause) => setError(messageFrom(cause)),
  })

  const startAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    const confirm = String(data.get('password_confirmation') ?? '')
    if (password !== confirm) {
      setError('گذرواژه و تکرار آن یکسان نیستند.')
      return
    }
    const next = {
      phone: String(data.get('phone') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      password,
      first_name: String(data.get('first_name') ?? '').trim(),
      last_name: String(data.get('last_name') ?? '').trim(),
      code: '',
    }
    setForm(next)
    setError('')
    requestCode.mutate(next)
  }

  if (isPending) {
    return (
      <section className="biz-page" dir="rtl" aria-busy="true">
        <p className="biz-loading">در حال آماده‌سازی ثبت‌نام…</p>
      </section>
    )
  }

  return (
    <section className="biz-page" dir="rtl">
      <header className="biz-heading">
        <p className="biz-kicker">حساب کسب‌وکار کارفنسا</p>
        <h1>ثبت‌نام و انتخاب هویت</h1>
        <p>یک حساب کاربری می‌تواند هم فعالیت فردی داشته باشد و هم چند شرکت را مدیریت کند.</p>
      </header>
      <ol className="biz-steps" aria-label="مراحل ثبت‌نام">
        {['حساب', 'هویت', 'اطلاعات', 'بررسی'].map((label, index) => (
          <li key={label} aria-current={index === stepIndex(step) ? 'step' : undefined}>
            {label}
          </li>
        ))}
      </ol>
      {error && (
        <p className="biz-error" role="alert">
          {error}
        </p>
      )}

      {step === 'account' && (
        <form className="biz-card" onSubmit={startAccount}>
          <h2>ساخت حساب</h2>
          <div className="biz-grid">
            <label>
              نام
              <input name="first_name" required autoComplete="given-name" />
            </label>
            <label>
              نام خانوادگی
              <input name="last_name" required autoComplete="family-name" />
            </label>
            <label>
              شماره موبایل
              <input name="phone" required inputMode="tel" autoComplete="tel" dir="ltr" placeholder="09123456789" />
            </label>
            <label>
              ایمیل
              <input name="email" type="email" required autoComplete="email" dir="ltr" />
            </label>
            <label>
              گذرواژه
              <input name="password" type="password" required minLength={12} autoComplete="new-password" />
            </label>
            <label>
              تکرار گذرواژه
              <input name="password_confirmation" type="password" required minLength={12} />
            </label>
          </div>
          <button className="biz-button" disabled={requestCode.isPending}>
            {requestCode.isPending ? 'در حال ارسال کد…' : 'دریافت کد تأیید'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form
          className="biz-card"
          onSubmit={(event) => {
            event.preventDefault()
            const code = String(new FormData(event.currentTarget).get('code') ?? '').trim()
            const next = { ...form, code }
            setForm(next)
            confirmCode.mutate(next)
          }}
        >
          <h2>تأیید شماره</h2>
          <p>کد تأیید به ایمیل {form.email} ارسال می‌شود. اگر حسابی از قبل وجود داشته باشد، پاسخ همین است.</p>
          <label>
            کد شش‌رقمی
            <input name="code" required inputMode="numeric" autoComplete="one-time-code" dir="ltr" pattern="[0-9]{6}" />
          </label>
          <button className="biz-button" disabled={confirmCode.isPending}>
            {confirmCode.isPending ? 'در حال بررسی…' : 'تأیید و ادامه'}
          </button>
        </form>
      )}

      {step === 'identity' && (
        <div className="biz-choice">
          <button type="button" className="biz-choice-card" onClick={() => setStep('company')}>
            <strong>ثبت شرکت</strong>
            <span>برای شخص حقوقی، تولیدکننده، بازرگان، حمل‌ونقل و سازمان خدماتی.</span>
          </button>
          <button type="button" className="biz-choice-card" onClick={() => setStep('individual')}>
            <strong>فعالیت فردی</strong>
            <span>برای فروشنده مستقل، کشاورز، صنعتگر و متخصص؛ بدون نیاز به ثبت شرکت.</span>
          </button>
        </div>
      )}

      {step === 'individual' && (
        <form
          className="biz-card"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            createIndividual.mutate({
              display_name: String(data.get('display_name') ?? '').trim(),
              professional_title: String(data.get('professional_title') ?? '').trim(),
              bio: String(data.get('bio') ?? '').trim(),
              province_id: provinceId ? Number(provinceId) : null,
              city_id: cityId ? Number(cityId) : null,
              public_phone: String(data.get('public_phone') ?? '').trim(),
              public_email: String(data.get('public_email') ?? '').trim(),
            })
          }}
        >
          <h2>پروفایل فردی</h2>
          <div className="biz-grid">
            <label>
              نام نمایشی
              <input name="display_name" required minLength={2} />
            </label>
            <label>
              عنوان حرفه‌ای
              <input name="professional_title" />
            </label>
            <label>
              تلفن عمومی
              <input name="public_phone" dir="ltr" />
            </label>
            <label>
              ایمیل عمومی
              <input name="public_email" type="email" dir="ltr" />
            </label>
            <LocationFields
              provinceId={provinceId}
              cityId={cityId}
              provinces={provinces.data ?? []}
              cities={cities.data ?? []}
              onProvince={setProvinceId}
              onCity={setCityId}
            />
          </div>
          <label>
            معرفی
            <textarea name="bio" rows={4} maxLength={1500} />
          </label>
          <button className="biz-button" disabled={createIndividual.isPending}>
            {createIndividual.isPending ? 'در حال ثبت…' : 'ثبت و ارسال برای بررسی'}
          </button>
        </form>
      )}

      {step === 'company' && (
        <form
          className="biz-card"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            createCompany.mutate({
              name: String(data.get('name') ?? '').trim(),
              organization_type: String(data.get('organization_type') ?? 'other'),
              national_id: String(data.get('national_id') ?? '').trim(),
              registration_number: String(data.get('registration_number') ?? '').trim(),
              economic_code: String(data.get('economic_code') ?? '').trim(),
              ceo_name: String(data.get('ceo_name') ?? '').trim(),
              representative_name: String(data.get('representative_name') ?? '').trim(),
              representative_phone: String(data.get('representative_phone') ?? '').trim(),
              phone: String(data.get('phone') ?? '').trim(),
              email: String(data.get('email') ?? '').trim(),
              website: String(data.get('website') ?? '').trim(),
              address: String(data.get('address') ?? '').trim(),
              description: String(data.get('description') ?? '').trim(),
              province_id: provinceId ? Number(provinceId) : null,
              city_id: cityId ? Number(cityId) : null,
            })
          }}
        >
          <h2>اطلاعات شرکت</h2>
          <div className="biz-grid">
            <label>
              نام رسمی
              <input name="name" required minLength={2} />
            </label>
            <label>
              نوع شرکت
              <select name="organization_type" defaultValue="trading">
                <option value="manufacturer">تولیدی</option>
                <option value="trading">بازرگانی</option>
                <option value="supplier">تأمین‌کننده</option>
                <option value="exporter">صادرکننده</option>
                <option value="importer">واردکننده</option>
                <option value="other">سایر</option>
              </select>
            </label>
            <label>
              شناسه ملی
              <input name="national_id" inputMode="numeric" dir="ltr" />
            </label>
            <label>
              شماره ثبت
              <input name="registration_number" dir="ltr" />
            </label>
            <label>
              کد اقتصادی
              <input name="economic_code" inputMode="numeric" dir="ltr" />
            </label>
            <label>
              نام مدیرعامل
              <input name="ceo_name" />
            </label>
            <label>
              نام نماینده
              <input name="representative_name" />
            </label>
            <label>
              تلفن نماینده
              <input name="representative_phone" dir="ltr" />
            </label>
            <label>
              تلفن شرکت
              <input name="phone" required dir="ltr" />
            </label>
            <label>
              ایمیل
              <input name="email" type="email" dir="ltr" />
            </label>
            <label>
              وب‌سایت
              <input name="website" type="url" dir="ltr" />
            </label>
            <LocationFields
              provinceId={provinceId}
              cityId={cityId}
              provinces={provinces.data ?? []}
              cities={cities.data ?? []}
              onProvince={setProvinceId}
              onCity={setCityId}
            />
          </div>
          <label>
            نشانی
            <textarea name="address" rows={2} />
          </label>
          <label>
            معرفی
            <textarea name="description" rows={3} />
          </label>
          <button className="biz-button" disabled={createCompany.isPending}>
            {createCompany.isPending ? 'در حال ثبت…' : 'ثبت و ارسال برای بررسی'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="biz-card">
          <h2>درخواست ثبت شد</h2>
          <p>وضعیت فعلی: در انتظار بررسی. مدیریت پروفایل باز است؛ انتشار عمومی پس از تأیید مدیر انجام می‌شود.</p>
          <button className="biz-button" type="button" onClick={() => navigate('/business')}>
            رفتن به داشبورد
          </button>
        </div>
      )}
      <p className="biz-footnote">
        <AppLink href="/account">بازگشت به حساب کاربری</AppLink>
      </p>
    </section>
  )
}

function stepIndex(step: Step) {
  if (step === 'account' || step === 'otp') return 0
  if (step === 'identity') return 1
  if (step === 'company' || step === 'individual') return 2
  return 3
}

function LocationFields({
  provinceId,
  cityId,
  provinces,
  cities,
  onProvince,
  onCity,
}: {
  provinceId: string
  cityId: string
  provinces: { id: number; name_fa: string }[]
  cities: { id: number; name_fa: string }[]
  onProvince: (value: string) => void
  onCity: (value: string) => void
}) {
  return (
    <>
      <label>
        استان
        <select
          name="province_id"
          value={provinceId}
          onChange={(event) => {
            onProvince(event.target.value)
            onCity('')
          }}
        >
          <option value="">انتخاب استان</option>
          {(Array.isArray(provinces) ? provinces : []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name_fa}
            </option>
          ))}
        </select>
      </label>
      <label>
        شهر
        <select name="city_id" value={cityId} disabled={!provinceId} onChange={(event) => onCity(event.target.value)}>
          <option value="">انتخاب شهر</option>
          {(Array.isArray(cities) ? cities : []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name_fa}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
