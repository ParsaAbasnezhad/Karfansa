import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Icon } from '@/features/home/icons'
import { apiPost } from '@/lib/api-client'
import { SITE, SOCIAL } from '@/lib/site'
import './about.css'

const topics = [
  'پشتیبانی فنی',
  'همکاری تجاری',
  'ثبت شرکت',
  'تبلیغات',
  'پیشنهاد و انتقاد',
  'سایر موارد',
] as const

const faqs = [
  {
    question: 'چطور دربارهٔ خدمات و محصولات کارفنسا راهنمایی بگیرم؟',
    answer:
      'در فرم تماس، موضوع «پشتیبانی فنی» را انتخاب کنید و پرسش‌تان را با جزئیات بنویسید. برای دیدن محصولات نیز می‌توانید به بازار محصولات سر بزنید.',
  },
  {
    question: 'برای پیشنهاد همکاری از چه مسیری اقدام کنم؟',
    answer:
      'موضوع «همکاری تجاری» را در فرم انتخاب کنید و نوع همکاری مورد نظرتان را شرح دهید. پیام شما برای بررسی در اختیار تیم کارفنسا قرار می‌گیرد.',
  },
  {
    question: 'از کجا وضعیت پیامم را پیگیری کنم؟',
    answer:
      'پس از ثبت موفق پیام، تأیید آن در همین صفحه نمایش داده می‌شود. در صورت نیاز به پیگیری، پیام دیگری با اشاره به موضوع درخواست قبلی ارسال کنید.',
  },
]

type ContactPayload = {
  name: string
  phone: string
  email: string
  subject: (typeof topics)[number] | ''
  message: string
  website: string
}

type ContactResponse = { message: string }
type ContactField = keyof Omit<ContactPayload, 'website'>
type ContactErrors = Partial<Record<ContactField, string>>

const initialValues: ContactPayload = {
  name: '',
  phone: '',
  email: '',
  subject: '',
  message: '',
  website: '',
}

function normalizeMobile(value: string): string {
  const latinDigits = value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - (digit >= '۰' ? 1728 : 1584)),
  )
  const compact = latinDigits.replace(/[\s()-]/g, '')
  if (/^09\d{9}$/.test(compact)) return `+98${compact.slice(1)}`
  if (/^0098\d{10}$/.test(compact)) return `+${compact.slice(2)}`
  return compact
}

function validate(values: ContactPayload): ContactErrors {
  const errors: ContactErrors = {}
  const name = values.name.trim()
  const email = values.email.trim()
  const message = values.message.trim()
  const phone = normalizeMobile(values.phone)

  if (name.length < 2 || name.length > 120) {
    errors.name = 'نام و نام خانوادگی باید بین ۲ تا ۱۲۰ نویسه باشد.'
  }
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
    errors.phone = 'شماره موبایل معتبر وارد کنید.'
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'نشانی ایمیل معتبر وارد کنید.'
  }
  if (!topics.includes(values.subject as (typeof topics)[number])) {
    errors.subject = 'یک موضوع از فهرست انتخاب کنید.'
  }
  if (message.length < 10 || message.length > 3000) {
    errors.message = 'متن پیام باید بین ۱۰ تا ۳۰۰۰ نویسه باشد.'
  }
  return errors
}

export function ContactPage() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<ContactErrors>({})
  const formRef = useRef<HTMLFormElement>(null)
  const requestInFlight = useRef(false)

  useEffect(() => {
    document.title = 'تماس با کارفنسا | راه‌های ارتباطی'
    const description = document.querySelector('meta[name="description"]')
    if (description) {
      description.setAttribute(
        'content',
        'برای دریافت راهنمایی، پشتیبانی و آغاز همکاری‌های تجاری، از راه‌های ارتباطی کارفنسا استفاده کنید.',
      )
    }
  }, [])

  const mutation = useMutation({
    mutationFn: (payload: ContactPayload) => apiPost<ContactResponse>('/v1/contact/', payload),
  })

  const updateField = (field: ContactField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    mutation.reset()
  }

  const validateField = (field: ContactField) => {
    const fieldErrors = validate(values)
    setErrors((current) => ({ ...current, [field]: fieldErrors[field] }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (requestInFlight.current) return

    const fieldErrors = validate(values)
    setErrors(fieldErrors)
    const firstInvalidField = (Object.keys(initialValues) as ContactField[]).find(
      (field) => fieldErrors[field],
    )
    if (firstInvalidField) {
      document.getElementById(`contact-${firstInvalidField}`)?.focus()
      return
    }

    requestInFlight.current = true
    mutation.mutate(
      {
        ...values,
        name: values.name.trim(),
        phone: normalizeMobile(values.phone),
        email: values.email.trim(),
        subject: values.subject,
        message: values.message.trim(),
      },
      { onSettled: () => (requestInFlight.current = false) },
    )
  }

  const socialLinks = SOCIAL.filter((item) => item.href !== 'https://wa.me/')

  return (
    <div className="contact-page" dir="rtl">
      <header className="contact-hero">
        <div className="contact-hero-copy">
          <span className="about-kicker">
            <i /> ارتباط با کارفنسا
          </span>
          <h1>در ارتباط با کارفنسا باشید</h1>
          <p>
            برای دریافت راهنمایی، پشتیبانی و آغاز همکاری‌های تجاری، از راه‌های ارتباطی زیر با ما در
            تماس باشید.
          </p>
        </div>
        <div className="contact-hero-art" aria-hidden="true">
          <span className="contact-art-orbit contact-art-orbit-one" />
          <span className="contact-art-orbit contact-art-orbit-two" />
          <span className="contact-art-node contact-art-node-one">
            <Icon name="mail" />
          </span>
          <span className="contact-art-node contact-art-node-two">
            <Icon name="route" />
          </span>
          <span className="contact-art-core">
            <Icon name="send" />
          </span>
        </div>
      </header>

      <section className="contact-info-grid" aria-label="اطلاعات تماس کارفنسا">
        <ContactInfoCard
          icon="phone"
          title="شماره تماس"
          value={SITE.phone}
          href={SITE.phone ? `tel:${SITE.phone}` : undefined}
        />
        <ContactInfoCard
          icon="mail"
          title="ایمیل رسمی"
          value={SITE.email}
          href={SITE.email ? `mailto:${SITE.email}` : undefined}
        />
        <ContactInfoCard icon="building" title="آدرس دفتر مرکزی" value={SITE.address} />
        <ContactInfoCard icon="clock" title="ساعات پاسخگویی" value={SITE.hours} />
      </section>

      <div className="contact-layout">
        <section className="contact-form-panel" aria-labelledby="contact-form-title">
          <span className="about-eyebrow">فرم ارتباط</span>
          <h2 id="contact-form-title">پیام خود را بنویسید</h2>
          <p className="contact-form-intro">همهٔ فیلدها الزامی هستند.</p>
          <form ref={formRef} onSubmit={submit} noValidate>
            <div className="contact-form-grid">
              <ContactField
                label="نام و نام خانوادگی"
                name="name"
                icon="user"
                value={values.name}
                error={errors.name}
                autoComplete="name"
                maxLength={120}
                onChange={(value) => updateField('name', value)}
                onBlur={() => validateField('name')}
              />
              <ContactField
                label="شماره موبایل"
                name="phone"
                icon="phone"
                value={values.phone}
                error={errors.phone}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                maxLength={24}
                onChange={(value) => updateField('phone', value)}
                onBlur={() => validateField('phone')}
              />
              <ContactField
                label="ایمیل"
                name="email"
                icon="mail"
                value={values.email}
                error={errors.email}
                type="email"
                autoComplete="email"
                maxLength={254}
                onChange={(value) => updateField('email', value)}
                onBlur={() => validateField('email')}
              />
              <label className="contact-field">
                <span className="contact-field-label">
                  موضوع پیام <i aria-hidden="true">*</i>
                </span>
                <span className="contact-input-wrap">
                  <Icon name="file" />
                  <select
                    id="contact-subject"
                    name="subject"
                    value={values.subject}
                    onChange={(event) => updateField('subject', event.target.value)}
                    onBlur={() => validateField('subject')}
                    aria-invalid={Boolean(errors.subject)}
                    aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
                    required
                  >
                    <option value="" disabled>
                      یک موضوع انتخاب کنید
                    </option>
                    {topics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </span>
                {errors.subject && (
                  <span className="contact-field-error" id="contact-subject-error">
                    {errors.subject}
                  </span>
                )}
              </label>
              <label className="contact-field contact-form-wide">
                <span className="contact-field-label">
                  متن پیام <i aria-hidden="true">*</i>
                </span>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={6}
                  minLength={10}
                  maxLength={3000}
                  value={values.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  onBlur={() => validateField('message')}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? 'contact-message-error' : undefined}
                  required
                />
                <span className="contact-message-meta">
                  <span>جزئیات پیام به بررسی دقیق‌تر کمک می‌کند.</span>
                  <span>{values.message.length}/۳۰۰۰</span>
                </span>
                {errors.message && (
                  <span className="contact-field-error" id="contact-message-error">
                    {errors.message}
                  </span>
                )}
              </label>
              <label className="contact-honeypot" aria-hidden="true">
                وب‌سایت
                <input
                  name="website"
                  value={values.website}
                  tabIndex={-1}
                  autoComplete="off"
                  onChange={(event) =>
                    setValues((current) => ({ ...current, website: event.target.value }))
                  }
                />
              </label>
            </div>
            {mutation.isError && (
              <p className="contact-error" role="alert">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'ارسال پیام انجام نشد. دوباره تلاش کنید.'}
              </p>
            )}
            {mutation.isSuccess && (
              <p className="contact-success" role="status" aria-live="polite">
                {mutation.data.message}
              </p>
            )}
            <button type="submit" className="contact-submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <span className="contact-spinner" aria-hidden="true" />
                  در حال ارسال…
                </>
              ) : (
                <>
                  ارسال پیام <Icon name="arrow-l" />
                </>
              )}
            </button>
            <p className="contact-privacy-note">
              اطلاعات شما فقط برای بررسی و پیگیری همین درخواست استفاده می‌شود.
            </p>
          </form>
        </section>

        <aside className="contact-aside" aria-labelledby="contact-shortcuts-title">
          <div className="contact-aside-top">
            <span className="about-eyebrow">مسیرهای سریع</span>
            <h2 id="contact-shortcuts-title">برای کارهای رایج، مستقیم اقدام کنید.</h2>
          </div>
          <Link className="contact-shortcut" to="/services/">
            <span className="contact-shortcut-icon">
              <Icon name="box" />
            </span>
            <span>
              <strong>بازار محصولات</strong>
              <small>مشاهدهٔ محصولات و ارسال درخواست خرید</small>
            </span>
            <Icon name="arrow-l" />
          </Link>
          <Link className="contact-shortcut" to="/trade/">
            <span className="contact-shortcut-icon">
              <Icon name="route" />
            </span>
            <span>
              <strong>فرصت‌های تجاری</strong>
              <small>مرور فرصت‌ها یا ثبت درخواست برای بررسی</small>
            </span>
            <Icon name="arrow-l" />
          </Link>
          <Link className="contact-shortcut" to="/news/">
            <span className="contact-shortcut-icon">
              <Icon name="news" />
            </span>
            <span>
              <strong>اخبار و اطلاعات اقتصادی</strong>
              <small>دسترسی به خبرها و داده‌های بازار</small>
            </span>
            <Icon name="arrow-l" />
          </Link>
          {!SITE.phone && !SITE.email && !SITE.address && !SITE.hours && (
            <p className="contact-no-details">
              راه‌های تماس مستقیم و ساعات کاری هنوز در تنظیمات سامانه ثبت نشده‌اند؛ می‌توانید از فرم
              بالا برای ارتباط استفاده کنید.
            </p>
          )}
        </aside>
      </div>

      <div className="contact-bottom-grid">
        {socialLinks.length > 0 && (
          <section className="contact-social-panel" aria-labelledby="contact-social-title">
            <span className="about-eyebrow">شبکه‌های اجتماعی</span>
            <h2 id="contact-social-title">همراه کارفنسا باشید</h2>
            <p>نشانی‌ها از تنظیمات رسمی وب‌سایت دریافت شده‌اند.</p>
            <div className="contact-social-links">
              {socialLinks.map((item) => (
                <a
                  href={item.href}
                  key={item.label}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`کارفنسا در ${item.label}`}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  <Icon name="arrow-l" />
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="contact-faq" aria-labelledby="contact-faq-title">
          <span className="about-eyebrow">پرسش‌های متداول</span>
          <h2 id="contact-faq-title">پیش از ارسال پیام</h2>
          <div className="contact-faq-list">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

type ContactInfoCardProps = {
  icon: 'phone' | 'mail' | 'building' | 'clock'
  title: string
  value: string
  href?: string
}

function ContactInfoCard({ icon, title, value, href }: ContactInfoCardProps) {
  return (
    <article className="contact-info-card">
      <span className="contact-info-icon">
        <Icon name={icon} />
      </span>
      <div>
        <h2>{title}</h2>
        {value ? (
          href ? (
            <a href={href} dir="auto">
              {value}
            </a>
          ) : (
            <p dir="auto">{value}</p>
          )
        ) : (
          <p className="contact-info-unavailable">در تنظیمات ثبت نشده است</p>
        )}
      </div>
    </article>
  )
}

type ContactFieldProps = {
  label: string
  name: 'name' | 'phone' | 'email'
  icon: 'user' | 'phone' | 'mail'
  value: string
  error?: string
  type?: 'text' | 'tel' | 'email'
  autoComplete: string
  inputMode?: 'tel'
  maxLength: number
  onChange: (value: string) => void
  onBlur: () => void
}

function ContactField({
  label,
  name,
  icon,
  value,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  onChange,
  onBlur,
}: ContactFieldProps) {
  const id = `contact-${name}`
  const errorId = `${id}-error`

  return (
    <label className="contact-field" htmlFor={id}>
      <span className="contact-field-label">
        {label} <i aria-hidden="true">*</i>
      </span>
      <span className="contact-input-wrap">
        <Icon name={icon} />
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          required
        />
      </span>
      {error && (
        <span className="contact-field-error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  )
}
