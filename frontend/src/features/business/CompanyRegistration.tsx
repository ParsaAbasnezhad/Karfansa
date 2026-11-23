import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIranProvinces, useProvinceCities } from '@/features/account/geography'
import { Icon } from '@/features/home/icons'
import { ApiError, apiPatch, apiPost, apiPostForm } from '@/lib/api-client'
import './company-registration.css'

type Page = 0 | 1 | 2
type CompanyData = {
  name: string
  organization_type: string
  national_id: string
  registration_number: string
  economic_code: string
  description: string
  ceo_name: string
  representative_name: string
  representative_phone: string
  phone: string
  email: string
  website: string
  province_id: string
  city_id: string
  address: string
}
type DataKey = keyof CompanyData
type DocumentKind = 'registration' | 'national_id' | 'tax' | 'representative' | 'identity' | 'other'

const initialData: CompanyData = {
  name: '',
  organization_type: 'trading',
  national_id: '',
  registration_number: '',
  economic_code: '',
  description: '',
  ceo_name: '',
  representative_name: '',
  representative_phone: '',
  phone: '',
  email: '',
  website: '',
  province_id: '',
  city_id: '',
  address: '',
}

const organizationTypes = [
  { value: 'manufacturer', label: 'تولیدی' },
  { value: 'trading', label: 'بازرگانی' },
  { value: 'supplier', label: 'تأمین‌کننده' },
  { value: 'exporter', label: 'صادرکننده' },
  { value: 'importer', label: 'واردکننده' },
  { value: 'other', label: 'سایر' },
]

const documentTypes: { kind: DocumentKind; title: string; description: string }[] = [
  { kind: 'registration', title: 'آگهی ثبت', description: 'آگهی تأسیس یا آخرین تغییرات' },
  { kind: 'national_id', title: 'مدرک شناسه ملی', description: 'سند مرتبط با شناسه ملی شرکت' },
  { kind: 'tax', title: 'مدرک مالیاتی', description: 'گواهی یا سند مالیاتی شرکت' },
  { kind: 'representative', title: 'معرفی‌نامه نماینده', description: 'در صورت اقدام از طرف شرکت' },
  { kind: 'identity', title: 'مدرک هویتی', description: 'مدرک هویتی نماینده' },
  { kind: 'other', title: 'سایر مدارک', description: 'مدرک تکمیلی در صورت نیاز' },
]

const allowedFiles: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}
const maxDocumentBytes = 5 * 1024 * 1024
const phonePattern = /^\+?[0-9\s\-()]{5,20}$/
const digitFields = new Set<DataKey>([
  'national_id',
  'registration_number',
  'economic_code',
  'representative_phone',
  'phone',
])

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
}

function validInputType(type: 'email' | 'url', value: string) {
  const input = document.createElement('input')
  input.type = type
  input.value = value
  return input.validity.valid
}

function validateField(name: DataKey, rawValue: string): string {
  const value = rawValue.trim()
  if (name === 'name') {
    if (value.length < 2) return 'نام رسمی شرکت باید دست‌کم ۲ نویسه باشد.'
    if (value.length > 200) return 'نام رسمی شرکت نباید بیش از ۲۰۰ نویسه باشد.'
  }
  if (name === 'phone' && !value) return 'شماره تماس شرکت را وارد کنید.'
  if (name === 'province_id' && !value) return 'استان محل فعالیت شرکت را انتخاب کنید.'
  if ((name === 'national_id' || name === 'economic_code') && value && !/^\d+$/.test(value))
    return 'این بخش فقط رقم می‌پذیرد.'
  if ((name === 'national_id' || name === 'economic_code') && value.length > 20)
    return 'حداکثر ۲۰ رقم وارد کنید.'
  if (name === 'registration_number' && value.length > 30) return 'حداکثر ۳۰ نویسه وارد کنید.'
  if ((name === 'phone' || name === 'representative_phone') && value && !phonePattern.test(value))
    return 'شماره تماس معتبر وارد کنید.'
  if (name === 'email' && value && !validInputType('email', value)) return 'ایمیل معتبر وارد کنید.'
  if (name === 'website' && value && !validInputType('url', value))
    return 'نشانی کامل وب‌سایت را وارد کنید؛ مانند https://example.com'
  return ''
}

const firstPageFields: DataKey[] = ['name', 'national_id', 'registration_number', 'economic_code']
const secondPageFields: DataKey[] = [
  'representative_phone',
  'phone',
  'email',
  'website',
  'province_id',
]

function errorsForPage(page: Page, data: CompanyData) {
  const fields = page === 0 ? firstPageFields : secondPageFields
  return Object.fromEntries(
    fields.map((name) => [name, validateField(name, data[name])]).filter(([, value]) => value),
  ) as Partial<Record<DataKey, string>>
}

function fileError(file: File) {
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  const expected = extension ? allowedFiles[extension] : undefined
  if (!expected || (file.type && file.type.toLowerCase() !== expected))
    return 'فقط فایل PDF، JPG، PNG یا WebP انتخاب کنید.'
  if (file.size > maxDocumentBytes) return 'حجم فایل باید حداکثر ۵ مگابایت باشد.'
  return ''
}

function fileSize(bytes: number) {
  const amount = bytes < 1024 * 1024 ? bytes / 1024 : bytes / (1024 * 1024)
  const unit = bytes < 1024 * 1024 ? 'کیلوبایت' : 'مگابایت'
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(amount)} ${unit}`
}

function apiMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'ارتباط با سرویس برقرار نشد. دوباره تلاش کنید.'
}

class DocumentUploadError extends Error {
  constructor(
    readonly kind: DocumentKind,
    message: string,
  ) {
    super(message)
  }
}

function CompanyField({
  name,
  label,
  value,
  onValue,
  error,
  placeholder,
  type = 'text',
  inputMode,
  dir,
  autoComplete,
  required = false,
  maxLength,
  multiline = false,
  hint,
}: {
  name: DataKey
  label: string
  value: string
  onValue: (name: DataKey, value: string) => void
  error?: string
  placeholder?: string
  type?: 'text' | 'tel' | 'email' | 'url'
  inputMode?: 'numeric' | 'tel' | 'email' | 'url'
  dir?: 'ltr'
  autoComplete?: string
  required?: boolean
  maxLength?: number
  multiline?: boolean
  hint?: string
}) {
  const id = `company-${name}`
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const shared = {
    id,
    name,
    value,
    'aria-label': label,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onValue(name, event.target.value),
    placeholder,
    dir,
    required,
    maxLength,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
  }
  return (
    <div className="company-field">
      <label htmlFor={id}>
        {label}{' '}
        <span className={required ? 'company-required' : 'company-optional'}>
          {required ? 'ضروری' : 'اختیاری'}
        </span>
      </label>
      {multiline ? (
        <textarea {...shared} rows={3} />
      ) : (
        <input {...shared} type={type} inputMode={inputMode} autoComplete={autoComplete} />
      )}
      {error ? (
        <p id={`${id}-error`} className="company-field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="company-field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function CompanyRegistration({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState<Page>(0)
  const [data, setData] = useState<CompanyData>(initialData)
  const [errors, setErrors] = useState<Partial<Record<DataKey, string>>>({})
  const [documents, setDocuments] = useState<Partial<Record<DocumentKind, File>>>({})
  const [documentErrors, setDocumentErrors] = useState<Partial<Record<DocumentKind, string>>>({})
  const [uploaded, setUploaded] = useState<DocumentKind[]>([])
  const [problem, setProblem] = useState('')
  const [phase, setPhase] = useState('')
  const [draftId, setDraftId] = useState('')
  const [completed, setCompleted] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const hasMounted = useRef(false)
  const draftIdRef = useRef('')
  const lastSavedRef = useRef('')
  const uploadedRef = useRef(new Set<DocumentKind>())
  const submitLock = useRef(false)
  const provinces = useIranProvinces()
  const cities = useProvinceCities(data.province_id)

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    headingRef.current?.focus()
  }, [page, completed])

  const submission = useMutation({
    mutationFn: async (values: CompanyData) => {
      const body = {
        ...values,
        name: values.name.trim(),
        national_id: values.national_id.trim(),
        registration_number: values.registration_number.trim(),
        economic_code: values.economic_code.trim(),
        ceo_name: values.ceo_name.trim(),
        representative_name: values.representative_name.trim(),
        representative_phone: values.representative_phone.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        website: values.website.trim(),
        address: values.address.trim(),
        description: values.description.trim(),
        province_id: values.province_id ? Number(values.province_id) : null,
        city_id: values.city_id ? Number(values.city_id) : null,
      }
      const serialized = JSON.stringify(body)
      let id = draftIdRef.current
      setPhase('در حال ذخیره اطلاعات شرکت…')
      if (!id) {
        const created = await apiPost<{ id: string }>('/v1/business/organizations', body)
        id = created.id
        draftIdRef.current = id
        setDraftId(id)
        lastSavedRef.current = serialized
      } else if (lastSavedRef.current !== serialized) {
        await apiPatch(`/v1/business/organizations/${id}`, body)
        lastSavedRef.current = serialized
      }

      for (const { kind } of documentTypes) {
        const file = documents[kind]
        if (!file || uploadedRef.current.has(kind)) continue
        setPhase('در حال بارگذاری مدارک…')
        const form = new FormData()
        form.set('kind', 'organization')
        form.set('identity_id', id)
        form.set('document_type', kind)
        form.set('upload', file)
        try {
          await apiPostForm('/v1/business/documents', form)
          uploadedRef.current.add(kind)
          setUploaded(Array.from(uploadedRef.current))
        } catch (error) {
          throw new DocumentUploadError(kind, apiMessage(error))
        }
      }

      setPhase('در حال ارسال برای بررسی…')
      await apiPost(`/v1/business/organizations/${id}/submit`, {})
    },
    onSuccess: async () => {
      setProblem('')
      setCompleted(true)
      await queryClient.invalidateQueries({ queryKey: ['business'] })
    },
    onError: (error) => {
      if (error instanceof DocumentUploadError) {
        setDocumentErrors((current) => ({ ...current, [error.kind]: error.message }))
        setProblem('بارگذاری یکی از مدارک انجام نشد. خطای آن را بررسی و دوباره تلاش کنید.')
      } else {
        setProblem(apiMessage(error))
      }
    },
  })

  const change = (name: DataKey, value: string) => {
    const normalized = digitFields.has(name) ? normalizeDigits(value) : value
    setData((current) => ({
      ...current,
      [name]: normalized,
      ...(name === 'province_id' ? { city_id: '' } : {}),
    }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setProblem('')
  }

  const focusFirstError = (next: Partial<Record<DataKey, string>>) => {
    const first = Object.keys(next)[0]
    if (first) window.setTimeout(() => document.getElementById(`company-${first}`)?.focus(), 0)
  }

  const nextPage = () => {
    const next = errorsForPage(page, data)
    setErrors(next)
    if (Object.keys(next).length) {
      focusFirstError(next)
      return
    }
    setProblem('')
    setPage((current) => (current === 0 ? 1 : 2))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitLock.current) return
    for (const checkPage of [0, 1] as Page[]) {
      const next = errorsForPage(checkPage, data)
      if (Object.keys(next).length) {
        setPage(checkPage)
        setErrors(next)
        focusFirstError(next)
        return
      }
    }
    submitLock.current = true
    setProblem('')
    setDocumentErrors({})
    void submission
      .mutateAsync(data)
      .catch(() => undefined)
      .finally(() => {
        submitLock.current = false
        setPhase('')
      })
  }

  const selectFile = (kind: DocumentKind, file?: File) => {
    if (!file) return
    const error = fileError(file)
    setDocumentErrors((current) => ({ ...current, [kind]: error }))
    if (error) return
    setDocuments((current) => ({ ...current, [kind]: file }))
    setProblem('')
  }

  const provinceOptions = Array.isArray(provinces.data) ? provinces.data : []
  const cityOptions = Array.isArray(cities.data) ? cities.data : []
  const provinceName = provinceOptions.find((item) => String(item.id) === data.province_id)?.name_fa
  const cityName = cityOptions.find((item) => String(item.id) === data.city_id)?.name_fa
  const typeName = organizationTypes.find((item) => item.value === data.organization_type)?.label

  if (completed) {
    return (
      <div className="company-registration company-registration--complete">
        <div className="company-complete-icon" aria-hidden="true">
          ✓
        </div>
        <p className="company-eyebrow">درخواست شما دریافت شد</p>
        <h1 ref={headingRef} tabIndex={-1}>
          ثبت شرکت با موفقیت انجام شد
        </h1>
        <p>
          اطلاعات شرکت برای بررسی ارسال شده است. وضعیت فعلی «در انتظار بررسی» است و تأیید نهایی پس
          از بررسی مدیران کارفنسا انجام می‌شود.
        </p>
        <div className="company-complete-note">
          <Icon name="clock" /> می‌توانید وضعیت درخواست و اطلاعات شرکت را در داشبورد کسب‌وکار دنبال
          کنید.
        </div>
        <button type="button" className="company-primary" onClick={() => navigate('/business')}>
          رفتن به داشبورد <Icon name="arrow-l" />
        </button>
      </div>
    )
  }

  return (
    <div className="company-registration">
      {onBack && (
        <button type="button" className="company-back" onClick={onBack}>
          <Icon name="chev-r" /> بازگشت به انتخاب هویت
        </button>
      )}
      <div className="company-hero">
        <div className="company-hero-icon">
          <Icon name="building" />
        </div>
        <div>
          <p className="company-eyebrow">ثبت هویت حقوقی در کارفنسا</p>
          <h1>شرکت‌تان را به کارفنسا معرفی کنید</h1>
          <p>
            اطلاعات اصلی را تکمیل کنید، مدارک را در صورت نیاز بیفزایید و درخواست را برای بررسی
            بفرستید.
          </p>
        </div>
      </div>

      <form className="company-card" onSubmit={submit} noValidate aria-busy={submission.isPending}>
        <div className="company-progress-head">
          <div>
            <span className="company-progress-caption">فرایند ثبت شرکت</span>
            <strong>مرحله {new Intl.NumberFormat('fa-IR').format(page + 1)} از ۳</strong>
          </div>
          <span className="company-progress-percent">
            {new Intl.NumberFormat('fa-IR').format(Math.round(((page + 1) / 3) * 100))}٪
          </span>
        </div>
        <ol className="company-progress" aria-label="مراحل ثبت شرکت">
          {['مشخصات شرکت', 'ارتباط و نماینده', 'مدارک و بازبینی'].map((label, index) => (
            <li
              key={label}
              className={index < page ? 'is-complete' : index === page ? 'is-current' : ''}
              aria-current={index === page ? 'step' : undefined}
            >
              <span className="company-progress-number" aria-hidden="true">
                {index < page ? '✓' : new Intl.NumberFormat('fa-IR').format(index + 1)}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <div className="company-card-body">
          {page === 0 && (
            <>
              <div className="company-step-heading">
                <span className="company-section-icon">
                  <Icon name="building" />
                </span>
                <div>
                  <h2 ref={headingRef} tabIndex={-1}>
                    مشخصات شرکت
                  </h2>
                  <p>نام و اطلاعات ثبتی را مطابق مدارک رسمی شرکت وارد کنید.</p>
                </div>
              </div>
              <section className="company-section" aria-labelledby="company-main-title">
                <div className="company-section-heading">
                  <h3 id="company-main-title">اطلاعات اصلی شرکت</h3>
                  <span>۰۱</span>
                </div>
                <div className="company-grid">
                  <CompanyField
                    name="name"
                    label="نام رسمی"
                    value={data.name}
                    onValue={change}
                    error={errors.name}
                    placeholder="نام ثبت‌شده شرکت"
                    required
                    maxLength={200}
                    autoComplete="organization"
                  />
                  <div className="company-field">
                    <label htmlFor="company-organization_type">
                      نوع شرکت <span className="company-optional">اختیاری</span>
                    </label>
                    <select
                      id="company-organization_type"
                      value={data.organization_type}
                      onChange={(event) => change('organization_type', event.target.value)}
                    >
                      {organizationTypes.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="company-span-2">
                    <CompanyField
                      name="description"
                      label="معرفی کوتاه"
                      value={data.description}
                      onValue={change}
                      placeholder="زمینه فعالیت و خدمات شرکت را کوتاه معرفی کنید"
                      multiline
                    />
                  </div>
                </div>
              </section>
              <section className="company-section" aria-labelledby="company-legal-title">
                <div className="company-section-heading">
                  <h3 id="company-legal-title">اطلاعات ثبتی و حقوقی</h3>
                  <span>۰۲</span>
                </div>
                <div className="company-grid">
                  <CompanyField
                    name="national_id"
                    label="شناسه ملی"
                    value={data.national_id}
                    onValue={change}
                    error={errors.national_id}
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="شناسه ملی شرکت"
                    maxLength={20}
                  />
                  <CompanyField
                    name="registration_number"
                    label="شماره ثبت"
                    value={data.registration_number}
                    onValue={change}
                    error={errors.registration_number}
                    dir="ltr"
                    placeholder="شماره ثبت شرکت"
                    maxLength={30}
                  />
                  <CompanyField
                    name="economic_code"
                    label="کد اقتصادی"
                    value={data.economic_code}
                    onValue={change}
                    error={errors.economic_code}
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="کد اقتصادی شرکت"
                    maxLength={20}
                  />
                </div>
              </section>
            </>
          )}

          {page === 1 && (
            <>
              <div className="company-step-heading">
                <span className="company-section-icon">
                  <Icon name="user" />
                </span>
                <div>
                  <h2 ref={headingRef} tabIndex={-1}>
                    ارتباط و نماینده
                  </h2>
                  <p>راه‌های تماس و محل فعالیت شرکت را ثبت کنید.</p>
                </div>
              </div>
              <section className="company-section" aria-labelledby="company-rep-title">
                <div className="company-section-heading">
                  <h3 id="company-rep-title">اطلاعات نماینده شرکت</h3>
                  <span>۰۳</span>
                </div>
                <div className="company-grid">
                  <CompanyField
                    name="ceo_name"
                    label="نام مدیرعامل"
                    value={data.ceo_name}
                    onValue={change}
                    placeholder="نام و نام خانوادگی"
                    autoComplete="off"
                    maxLength={150}
                  />
                  <CompanyField
                    name="representative_name"
                    label="نام نماینده"
                    value={data.representative_name}
                    onValue={change}
                    placeholder="نام و نام خانوادگی"
                    maxLength={150}
                  />
                  <CompanyField
                    name="representative_phone"
                    label="تلفن نماینده"
                    value={data.representative_phone}
                    onValue={change}
                    error={errors.representative_phone}
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    placeholder="مثلاً 09123456789"
                    maxLength={20}
                  />
                </div>
              </section>
              <section className="company-section" aria-labelledby="company-contact-title">
                <div className="company-section-heading">
                  <h3 id="company-contact-title">آدرس و اطلاعات تماس</h3>
                  <span>۰۴</span>
                </div>
                <div className="company-grid">
                  <CompanyField
                    name="phone"
                    label="تلفن شرکت"
                    value={data.phone}
                    onValue={change}
                    error={errors.phone}
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    placeholder="شماره تماس شرکت"
                    autoComplete="tel"
                    required
                    maxLength={20}
                  />
                  <CompanyField
                    name="email"
                    label="ایمیل"
                    value={data.email}
                    onValue={change}
                    error={errors.email}
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                  <CompanyField
                    name="website"
                    label="وب‌سایت"
                    value={data.website}
                    onValue={change}
                    error={errors.website}
                    type="url"
                    inputMode="url"
                    dir="ltr"
                    placeholder="https://example.com"
                    autoComplete="url"
                  />
                  <div className="company-field">
                    <label htmlFor="company-province_id">
                      استان <span className="company-required">ضروری</span>
                    </label>
                    <select
                      id="company-province_id"
                      value={data.province_id}
                      onChange={(event) => change('province_id', event.target.value)}
                      required
                      aria-invalid={Boolean(errors.province_id)}
                      aria-describedby={
                        errors.province_id ? 'company-province_id-error' : undefined
                      }
                    >
                      <option value="">
                        {provinces.isLoading ? 'در حال دریافت استان‌ها…' : 'انتخاب استان'}
                      </option>
                      {provinceOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name_fa}
                        </option>
                      ))}
                    </select>
                    {errors.province_id && (
                      <p id="company-province_id-error" className="company-field-error">
                        {errors.province_id}
                      </p>
                    )}
                    {provinces.isError && (
                      <p className="company-field-error" role="alert">
                        دریافت استان‌ها انجام نشد. صفحه را تازه‌سازی کنید.
                      </p>
                    )}
                  </div>
                  <div className="company-field">
                    <label htmlFor="company-city_id">
                      شهر <span className="company-optional">اختیاری</span>
                    </label>
                    <select
                      id="company-city_id"
                      value={data.city_id}
                      onChange={(event) => change('city_id', event.target.value)}
                      disabled={!data.province_id || cities.isLoading}
                    >
                      <option value="">
                        {cities.isLoading ? 'در حال دریافت شهرها…' : 'انتخاب شهر'}
                      </option>
                      {cityOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name_fa}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="company-span-2">
                    <CompanyField
                      name="address"
                      label="نشانی"
                      value={data.address}
                      onValue={change}
                      placeholder="نشانی دفتر یا محل فعالیت شرکت"
                      multiline
                      autoComplete="street-address"
                    />
                  </div>
                </div>
              </section>
            </>
          )}

          {page === 2 && (
            <>
              <div className="company-step-heading">
                <span className="company-section-icon">
                  <Icon name="file" />
                </span>
                <div>
                  <h2 ref={headingRef} tabIndex={-1}>
                    مدارک و بازبینی
                  </h2>
                  <p>مدارک اختیاری را اضافه کنید و پیش از ارسال، اطلاعات را یک بار مرور کنید.</p>
                </div>
              </div>
              <section className="company-section" aria-labelledby="company-docs-title">
                <div className="company-section-heading">
                  <h3 id="company-docs-title">بارگذاری مدارک</h3>
                  <span>۰۵</span>
                </div>
                <p className="company-section-note">
                  فایل‌ها خصوصی هستند. فرمت‌های PDF، JPG، PNG و WebP تا حجم ۵ مگابایت پذیرفته
                  می‌شوند. افزودن مدرک در این مرحله اختیاری است.
                </p>
                <div className="company-upload-grid">
                  {documentTypes.map(({ kind, title, description }) => {
                    const file = documents[kind]
                    const isUploaded = uploaded.includes(kind)
                    const error = documentErrors[kind]
                    return (
                      <div
                        className={`company-upload-card${file ? ' has-file' : ''}${error ? ' has-error' : ''}`}
                        key={kind}
                      >
                        <span className="company-upload-symbol">
                          <Icon name="file" />
                        </span>
                        <div className="company-upload-content">
                          <strong>{title}</strong>
                          <p>{description}</p>
                          {file && (
                            <span className="company-file-name">
                              <bdi>{file.name}</bdi> · {fileSize(file.size)}
                              {isUploaded ? ' · بارگذاری شد' : ''}
                            </span>
                          )}
                        </div>
                        <div className="company-upload-actions">
                          {isUploaded ? (
                            <span className="company-uploaded">ثبت شد</span>
                          ) : (
                            <label
                              htmlFor={`company-file-${kind}`}
                              className="company-upload-select"
                            >
                              {file ? 'تغییر فایل' : 'انتخاب فایل'}
                            </label>
                          )}
                          {file && !isUploaded && (
                            <button
                              type="button"
                              className="company-upload-remove"
                              aria-label={`حذف فایل ${title}`}
                              onClick={() => {
                                setDocuments((current) => ({ ...current, [kind]: undefined }))
                                setDocumentErrors((current) => ({ ...current, [kind]: '' }))
                              }}
                            >
                              حذف
                            </button>
                          )}
                        </div>
                        <input
                          id={`company-file-${kind}`}
                          className="company-file-input"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          aria-label={`انتخاب فایل ${title}`}
                          aria-invalid={Boolean(error)}
                          disabled={isUploaded || submission.isPending}
                          onChange={(event) => {
                            selectFile(kind, event.target.files?.[0])
                            event.target.value = ''
                          }}
                          aria-describedby={error ? `company-file-${kind}-error` : undefined}
                        />
                        {error && (
                          <p
                            id={`company-file-${kind}-error`}
                            className="company-upload-error"
                            role="alert"
                          >
                            {error}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {uploaded.length > 0 && (
                  <p className="company-upload-saved-note">
                    مدارک بارگذاری‌شده در این مرحله قابل حذف یا جایگزینی نیستند. برای افزودن نسخه
                    تازه، از داشبورد شرکت استفاده کنید.
                  </p>
                )}
              </section>
              <section className="company-section" aria-labelledby="company-review-title">
                <div className="company-section-heading">
                  <h3 id="company-review-title">بررسی و ثبت نهایی</h3>
                  <span>۰۶</span>
                </div>
                <div className="company-review">
                  <div className="company-review-group">
                    <strong>شرکت</strong>
                    <dl>
                      <dt>نام رسمی</dt>
                      <dd>{data.name || '—'}</dd>
                      <dt>نوع فعالیت</dt>
                      <dd>{typeName || '—'}</dd>
                      <dt>شناسه ملی</dt>
                      <dd>
                        <bdi>{data.national_id || '—'}</bdi>
                      </dd>
                      <dt>شماره ثبت</dt>
                      <dd>
                        <bdi>{data.registration_number || '—'}</bdi>
                      </dd>
                      <dt>کد اقتصادی</dt>
                      <dd>
                        <bdi>{data.economic_code || '—'}</bdi>
                      </dd>
                      <dt>معرفی کوتاه</dt>
                      <dd>{data.description || '—'}</dd>
                      <dt>نام مدیرعامل</dt>
                      <dd>{data.ceo_name || '—'}</dd>
                    </dl>
                  </div>
                  <div className="company-review-group">
                    <strong>ارتباط</strong>
                    <dl>
                      <dt>تلفن شرکت</dt>
                      <dd>
                        <bdi>{data.phone || '—'}</bdi>
                      </dd>
                      <dt>نماینده</dt>
                      <dd>{data.representative_name || '—'}</dd>
                      <dt>تلفن نماینده</dt>
                      <dd>
                        <bdi>{data.representative_phone || '—'}</bdi>
                      </dd>
                      <dt>ایمیل</dt>
                      <dd>
                        <bdi>{data.email || '—'}</bdi>
                      </dd>
                      <dt>وب‌سایت</dt>
                      <dd>
                        <bdi>{data.website || '—'}</bdi>
                      </dd>
                      <dt>استان و شهر</dt>
                      <dd>{[provinceName, cityName].filter(Boolean).join('، ') || '—'}</dd>
                      <dt>نشانی</dt>
                      <dd>{data.address || '—'}</dd>
                      <dt>مدارک انتخاب‌شده</dt>
                      <dd>
                        {Object.values(documents).filter(Boolean).length.toLocaleString('fa-IR')}
                      </dd>
                    </dl>
                  </div>
                </div>
                <p className="company-review-note">
                  <Icon name="clock" /> پس از ثبت، درخواست برای بررسی مدیران ارسال می‌شود. ثبت
                  درخواست به معنی تأیید شرکت نیست.
                </p>
              </section>
            </>
          )}

          {problem && (
            <div className="company-submit-error" role="alert">
              <Icon name="x" />
              <span>
                {problem}
                {draftId &&
                  ' اطلاعات ثبت‌شده به‌صورت پیش‌نویس باقی مانده‌اند و می‌توانید دوباره تلاش کنید.'}
              </span>
            </div>
          )}
        </div>
        <div className="company-footer">
          {page > 0 && (
            <button
              type="button"
              className="company-secondary"
              onClick={() => {
                setPage((current) => (current === 2 ? 1 : 0))
                setProblem('')
              }}
              disabled={submission.isPending}
            >
              <Icon name="chev-r" /> مرحله قبل
            </button>
          )}
          {page < 2 ? (
            <button type="button" className="company-primary" onClick={nextPage}>
              ادامه <Icon name="arrow-l" />
            </button>
          ) : (
            <button type="submit" className="company-primary" disabled={submission.isPending}>
              {submission.isPending ? phase : 'ثبت و ارسال برای بررسی'}
              {!submission.isPending && <Icon name="arrow-l" />}
            </button>
          )}
        </div>
      </form>
      <p className="company-support-note">
        <Icon name="clock" /> بررسی هویت حقوقی ممکن است به زمان نیاز داشته باشد. وضعیت را از داشبورد
        دنبال کنید.
      </p>
    </div>
  )
}
