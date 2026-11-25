import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ManagementStatusBadge } from '@/components/management/ManagementLayout'
import { BusinessIcon } from './BusinessIcons'
import { statusLabels } from './BusinessDashboardStatus'
import { useIranProvinces } from '@/features/account/geography'
import { ApiError, apiGet, apiPatch, apiPostForm } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import './business.css'
import './business-profile-mobile.css'

function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'ارتباط با سرویس برقرار نشد.'
}

export function ProfilePanel({
  kind,
  id,
  completion,
  checklist,
}: {
  kind: string
  id: string
  completion: number | null
  checklist: { label: string; done: boolean }[]
}) {
  const queryClient = useQueryClient()
  const provinces = useIranProvinces()
  const [notice, setNotice] = useState('')
  const [problem, setProblem] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const imageFormRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])
  const path =
    kind === 'organization' ? `/v1/business/organizations/${id}` : '/v1/business/individual'
  const profile = useQuery({
    queryKey: ['business', 'profile', kind, id],
    queryFn: () => apiGet<Record<string, string | number | boolean | null>>(path),
  })
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPatch(path, body),
    onSuccess: async () => {
      setProblem('')
      setNotice('اطلاعات ذخیره شد.')
      await queryClient.invalidateQueries({ queryKey: ['business'] })
    },
    onError: (cause) => setProblem(messageFrom(cause)),
  })
  const upload = useMutation({
    mutationFn: (form: FormData) =>
      apiPostForm(
        path.includes('/organizations/') ? `${path}/image` : '/v1/business/individual/image',
        form,
      ),
    onSuccess: async () => {
      setProblem('')
      setNotice('تصویر ذخیره شد.')
      setSelectedImage(null)
      setImagePreview('')
      imageFormRef.current?.reset()
      await queryClient.invalidateQueries({ queryKey: ['business', 'profile', kind, id] })
    },
    onError: (cause) => setProblem(messageFrom(cause)),
  })
  const record = profile.data
  if (profile.isLoading)
    return (
      <section className="biz-card" aria-busy="true">
        <p>در حال بارگذاری پروفایل…</p>
      </section>
    )
  if (profile.isError || !record)
    return (
      <section className="biz-card">
        <p className="biz-error" role="alert">
          دریافت پروفایل انجام نشد.
        </p>
        <button className="biz-button" type="button" onClick={() => void profile.refetch()}>
          تلاش دوباره
        </button>
      </section>
    )
  const text = (name: string) => String(record[name] ?? '')
  const profileName = text(kind === 'organization' ? 'name' : 'display_name')
  const verificationStatus = text('verification_status')
  const verificationTone = ['verified', 'approved'].includes(verificationStatus)
    ? 'success'
    : verificationStatus === 'rejected' || verificationStatus === 'suspended'
      ? 'danger'
      : verificationStatus === 'pending_review'
        ? 'warning'
        : 'info'
  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const province = Number(data.get('province_id'))
    if (kind === 'organization') {
      save.mutate({
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
        province_id: Number.isFinite(province) && province > 0 ? province : null,
      })
      return
    }
    save.mutate({
      display_name: String(data.get('display_name') ?? '').trim(),
      professional_title: String(data.get('professional_title') ?? '').trim(),
      bio: String(data.get('bio') ?? '').trim(),
      public_phone: String(data.get('public_phone') ?? '').trim(),
      public_email: String(data.get('public_email') ?? '').trim(),
      is_public: data.get('is_public') === 'on',
      province_id: Number.isFinite(province) && province > 0 ? province : null,
    })
  }
  return (
    <section className="biz-card biz-profile-panel">
      <div className="biz-profile-identity">
        <span className="biz-profile-avatar" aria-hidden="true">
          {imagePreview ? (
            <img src={imagePreview} alt="" />
          ) : (
            <BusinessIcon name={kind === 'organization' ? 'building' : 'user'} />
          )}
        </span>
        <div className="biz-profile-identity-copy">
          <small>{kind === 'organization' ? 'پروفایل شرکت' : 'پروفایل فردی'}</small>
          <strong>{profileName || 'نام کسب‌وکار ثبت نشده'}</strong>
          {verificationStatus && (
            <ManagementStatusBadge tone={verificationTone}>
              {statusLabels[verificationStatus] ?? verificationStatus}
            </ManagementStatusBadge>
          )}
        </div>
      </div>
      <div className="biz-profile-completion">
        <div>
          <span>تکمیل پروفایل</span>
          <strong>{completion === null ? '—' : `${formatNumber(completion)}٪`}</strong>
        </div>
        <div
          className="biz-profile-progress"
          role="progressbar"
          aria-label="تکمیل پروفایل"
          aria-valuenow={completion ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${completion ?? 0}%` }} />
        </div>
        <ul className="biz-profile-checklist">
          {checklist.map((item) => (
            <li key={item.label} className={item.done ? 'is-done' : ''}>
              <BusinessIcon name={item.done ? 'check' : 'clock'} />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      {notice && (
        <p className="biz-success" role="status">
          {notice}
        </p>
      )}
      {problem && (
        <p className="biz-error" role="alert">
          {problem}
        </p>
      )}
      <form
        className="biz-profile-form"
        key={`${kind}-${id}-${text('display_name')}${text('name')}`}
        onSubmit={saveProfile}
      >
        {kind === 'organization' ? (
          <>
            <details className="biz-profile-section" open>
              <summary>اطلاعات ثبتی</summary>
              <div className="biz-profile-fields">
                <label>
                  نام رسمی شرکت
                  <input name="name" required minLength={2} defaultValue={text('name')} />
                </label>
                <label>
                  نوع فعالیت
                  <select
                    name="organization_type"
                    defaultValue={text('organization_type') || 'other'}
                  >
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
                  <input name="national_id" defaultValue={text('national_id')} dir="ltr" />
                </label>
                <label>
                  شماره ثبت
                  <input
                    name="registration_number"
                    defaultValue={text('registration_number')}
                    dir="ltr"
                  />
                </label>
                <label>
                  کد اقتصادی
                  <input name="economic_code" defaultValue={text('economic_code')} dir="ltr" />
                </label>
              </div>
            </details>
            <details className="biz-profile-section">
              <summary>تماس و نماینده</summary>
              <div className="biz-profile-fields">
                <label>
                  مدیرعامل
                  <input name="ceo_name" defaultValue={text('ceo_name')} />
                </label>
                <label>
                  نام نماینده
                  <input name="representative_name" defaultValue={text('representative_name')} />
                </label>
                <label>
                  تلفن نماینده
                  <input
                    name="representative_phone"
                    defaultValue={text('representative_phone')}
                    dir="ltr"
                    inputMode="tel"
                  />
                </label>
                <label>
                  تلفن شرکت
                  <input name="phone" defaultValue={text('phone')} dir="ltr" inputMode="tel" />
                </label>
                <label>
                  ایمیل
                  <input name="email" type="email" defaultValue={text('email')} dir="ltr" />
                </label>
                <label>
                  وب‌سایت
                  <input name="website" defaultValue={text('website')} dir="ltr" />
                </label>
              </div>
            </details>
            <details className="biz-profile-section">
              <summary>نشانی و معرفی</summary>
              <div className="biz-profile-fields">
                <label className="is-wide">
                  نشانی
                  <textarea name="address" rows={2} defaultValue={text('address')} />
                </label>
                <label className="is-wide">
                  توضیح شرکت
                  <textarea name="description" rows={3} defaultValue={text('description')} />
                </label>
              </div>
            </details>
          </>
        ) : (
          <>
            <details className="biz-profile-section" open>
              <summary>اطلاعات حرفه‌ای</summary>
              <div className="biz-profile-fields">
                <label>
                  نام نمایشی
                  <input
                    name="display_name"
                    required
                    minLength={2}
                    defaultValue={text('display_name')}
                  />
                </label>
                <label>
                  عنوان حرفه‌ای
                  <input name="professional_title" defaultValue={text('professional_title')} />
                </label>
                <label>
                  تلفن عمومی
                  <input
                    name="public_phone"
                    defaultValue={text('public_phone')}
                    dir="ltr"
                    inputMode="tel"
                  />
                </label>
                <label>
                  ایمیل عمومی
                  <input
                    name="public_email"
                    type="email"
                    defaultValue={text('public_email')}
                    dir="ltr"
                  />
                </label>
              </div>
            </details>
            <details className="biz-profile-section">
              <summary>معرفی و دسترسی عمومی</summary>
              <div className="biz-profile-fields">
                <label className="is-wide">
                  معرفی
                  <textarea name="bio" rows={3} defaultValue={text('bio')} />
                </label>
                <label className="biz-profile-visibility">
                  <input
                    name="is_public"
                    type="checkbox"
                    defaultChecked={record.is_public !== false}
                  />
                  <span>نمایش پروفایل برای عموم</span>
                </label>
              </div>
            </details>
          </>
        )}
        <label className="biz-profile-province">
          استان
          <select
            name="province_id"
            defaultValue={record.province_id ? String(record.province_id) : ''}
          >
            <option value="">بدون استان</option>
            {(Array.isArray(provinces.data) ? provinces.data : []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name_fa}
              </option>
            ))}
          </select>
        </label>
        <button className="biz-button biz-profile-save" disabled={save.isPending}>
          {save.isPending ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
        </button>
      </form>
      <form
        className="biz-profile-image"
        ref={imageFormRef}
        onSubmit={(event) => {
          event.preventDefault()
          if (!selectedImage) return
          const body = new FormData()
          body.set('slot', String(new FormData(event.currentTarget).get('slot') ?? 'profile'))
          body.set('upload', selectedImage)
          upload.mutate(body)
        }}
      >
        <div className="biz-profile-subheading">
          <span className="biz-profile-avatar is-small" aria-hidden="true">
            {imagePreview ? <img src={imagePreview} alt="" /> : <BusinessIcon name="document" />}
          </span>
          <div>
            <h3>{kind === 'organization' ? 'تصویر و نشان شرکت' : 'تصویر پروفایل'}</h3>
            <p>JPG، PNG یا WebP · حداکثر ۲ مگابایت</p>
          </div>
        </div>
        <label>
          نوع تصویر
          <select name="slot" defaultValue={kind === 'organization' ? 'logo' : 'profile'}>
            {kind === 'organization' ? (
              <>
                <option value="logo">لوگو</option>
                <option value="cover">کاور</option>
              </>
            ) : (
              <>
                <option value="profile">پروفایل</option>
                <option value="cover">کاور</option>
              </>
            )}
          </select>
        </label>
        <label className="biz-profile-file">
          <span>انتخاب تصویر</span>
          <input
            name="upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null
              setSelectedImage(file)
              setImagePreview(file ? URL.createObjectURL(file) : '')
            }}
          />
        </label>
        {selectedImage && (
          <span className="biz-profile-file-name" dir="auto">
            {selectedImage.name}
          </span>
        )}
        <button className="biz-button" disabled={!selectedImage || upload.isPending}>
          {upload.isPending ? 'در حال بارگذاری…' : 'بارگذاری تصویر'}
        </button>
      </form>
    </section>
  )
}

export function OpportunityForm({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const provinces = useIranProvinces()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit({
      title: String(data.get('title') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
      opportunity_type: String(data.get('opportunity_type') ?? 'export'),
      province_id: Number(data.get('province_id')),
      source: 'ثبت‌شده از داشبورد شرکت',
    })
  }
  return (
    <form onSubmit={submit}>
      <h3>فرصت تازه</h3>
      <label>
        عنوان
        <input name="title" required minLength={3} />
      </label>
      <label>
        نوع
        <select name="opportunity_type" defaultValue="export">
          <option value="export">صادرات</option>
          <option value="import">واردات</option>
          <option value="raw-materials">تأمین مواد اولیه</option>
          <option value="bulk-buy">خرید عمده</option>
          <option value="bulk-sell">فروش عمده</option>
          <option value="partnership">همکاری تجاری</option>
          <option value="investment">سرمایه‌گذاری</option>
        </select>
      </label>
      <label>
        استان
        <select name="province_id" required defaultValue="">
          <option value="" disabled>
            انتخاب استان
          </option>
          {(Array.isArray(provinces.data) ? provinces.data : []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name_fa}
            </option>
          ))}
        </select>
      </label>
      <label>
        توضیحات
        <textarea name="description" required minLength={10} rows={3} />
      </label>
      <button className="biz-button" disabled={busy}>
        {busy ? 'در حال ثبت…' : 'ثبت فرصت'}
      </button>
    </form>
  )
}
