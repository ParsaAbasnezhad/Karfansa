import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useIranProvinces } from '@/features/account/geography'
import { ApiError, apiGet, apiPatch, apiPost, apiPostForm } from '@/lib/api-client'
import './business.css'

function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'ارتباط با سرویس برقرار نشد.'
}

export function ProfilePanel({
  kind,
  id,
  canSubmit,
}: {
  kind: string
  id: string
  canSubmit: boolean
}) {
  const queryClient = useQueryClient()
  const provinces = useIranProvinces()
  const [notice, setNotice] = useState('')
  const [problem, setProblem] = useState('')
  const path =
    kind === 'organization' ? `/v1/business/organizations/${id}` : '/v1/business/individual'
  const profile = useQuery({
    queryKey: ['business', 'profile', kind, id],
    queryFn: () => apiGet<Record<string, string | number | boolean | null>>(path),
  })
  const documents = useQuery({
    queryKey: ['business', 'documents', kind, id],
    queryFn: () =>
      apiGet<{ id: number; document_type: string; review_status: string }[]>(
        `/v1/business/documents?kind=${kind}&identity_id=${id}`,
      ),
    enabled: canSubmit,
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
  const submitReview = useMutation({
    mutationFn: () =>
      apiPost(kind === 'organization' ? `${path}/submit` : '/v1/business/individual/submit', {}),
    onSuccess: async () => {
      setProblem('')
      setNotice('درخواست بررسی ثبت شد.')
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
      await queryClient.invalidateQueries({ queryKey: ['business', 'profile', kind, id] })
    },
    onError: (cause) => setProblem(messageFrom(cause)),
  })
  const uploadDocument = useMutation({
    mutationFn: (form: FormData) => apiPostForm('/v1/business/documents', form),
    onSuccess: async () => {
      setProblem('')
      setNotice('مدرک بارگذاری شد.')
      await queryClient.invalidateQueries({ queryKey: ['business', 'documents'] })
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
    <section className="biz-card">
      <h2>ویرایش پروفایل</h2>
      {notice && <p>{notice}</p>}
      {problem && (
        <p className="biz-error" role="alert">
          {problem}
        </p>
      )}
      <form key={`${kind}-${id}-${text('display_name')}${text('name')}`} onSubmit={saveProfile}>
        {kind === 'organization' ? (
          <>
            <label>
              نام رسمی
              <input name="name" required minLength={2} defaultValue={text('name')} />
            </label>
            <label>
              نوع
              <select name="organization_type" defaultValue={text('organization_type') || 'other'}>
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
              />
            </label>
            <label>
              تلفن
              <input name="phone" defaultValue={text('phone')} dir="ltr" />
            </label>
            <label>
              ایمیل
              <input name="email" type="email" defaultValue={text('email')} dir="ltr" />
            </label>
            <label>
              وب‌سایت
              <input name="website" defaultValue={text('website')} dir="ltr" />
            </label>
            <label>
              نشانی
              <textarea name="address" rows={2} defaultValue={text('address')} />
            </label>
            <label>
              توضیح
              <textarea name="description" rows={3} defaultValue={text('description')} />
            </label>
          </>
        ) : (
          <>
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
              <input name="public_phone" defaultValue={text('public_phone')} dir="ltr" />
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
            <label>
              معرفی
              <textarea name="bio" rows={3} defaultValue={text('bio')} />
            </label>
            <label>
              <input name="is_public" type="checkbox" defaultChecked={record.is_public !== false} />{' '}
              نمایش عمومی
            </label>
          </>
        )}
        <label>
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
        <button className="biz-button" disabled={save.isPending}>
          {save.isPending ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
        </button>
      </form>
      {canSubmit && (
        <button
          className="biz-button"
          type="button"
          disabled={submitReview.isPending}
          onClick={() => submitReview.mutate()}
        >
          {submitReview.isPending ? 'در حال ارسال…' : 'ارسال برای بررسی'}
        </button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const file = data.get('upload')
          if (!(file instanceof File) || file.size === 0) return
          const body = new FormData()
          body.set('slot', String(data.get('slot') ?? 'profile'))
          body.set('upload', file)
          upload.mutate(body)
          event.currentTarget.reset()
        }}
      >
        <h3>تصویر</h3>
        <label>
          نوع
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
        <label>
          فایل
          <input name="upload" type="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
        <button className="biz-button" disabled={upload.isPending}>
          {upload.isPending ? 'در حال بارگذاری…' : 'بارگذاری تصویر'}
        </button>
      </form>
      {canSubmit && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const file = data.get('upload')
            if (!(file instanceof File) || file.size === 0) return
            const body = new FormData()
            body.set('kind', kind)
            body.set('identity_id', id)
            body.set('document_type', String(data.get('document_type') ?? 'other'))
            body.set('upload', file)
            uploadDocument.mutate(body)
            event.currentTarget.reset()
          }}
        >
          <h3>مدارک تأیید</h3>
          {(documents.data ?? []).map((item) => (
            <p key={item.id}>
              {item.document_type} · {item.review_status}
            </p>
          ))}
          <label>
            نوع مدرک
            <select
              name="document_type"
              defaultValue={kind === 'organization' ? 'registration' : 'identity'}
            >
              <option value="identity">مدرک هویتی</option>
              <option value="national_id">شناسه ملی</option>
              <option value="registration">آگهی ثبت</option>
              <option value="tax">مدرک مالیاتی</option>
              <option value="representative">معرفی‌نامه</option>
              <option value="other">سایر</option>
            </select>
          </label>
          <label>
            فایل خصوصی
            <input name="upload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required />
          </label>
          <button className="biz-button" disabled={uploadDocument.isPending}>
            {uploadDocument.isPending ? 'در حال بارگذاری…' : 'بارگذاری مدرک'}
          </button>
        </form>
      )}
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
