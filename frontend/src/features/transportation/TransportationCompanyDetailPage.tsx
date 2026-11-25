import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Icon } from '@/features/home/icons'
import { Breadcrumb, DirectoryEmpty, DirectoryError } from '@/features/directory/shared'
import {
  DetailPageSkeleton,
  ProfileQuickFacts,
  ProfileSectionTabs,
  ResponsiveSection,
  ShareButton,
  joinPlace,
  useDocumentTitle,
  useSectionNavigation,
} from '@/features/directory/detail-shared'
import { ApiError, apiGet } from '@/lib/api-client'
import { transportCategoryIcon, transportCategoryTitle } from './icons'
import { emailHref, instagramHref, phoneHref, telegramHref, websiteHref } from './contact-links'
import type { TransportCompanyDetail } from './types'
import './transportation.css'

function ContactCard({
  href,
  icon,
  label,
  value,
  external = false,
}: {
  href: string
  icon: 'phone' | 'mail' | 'send' | 'instagram'
  label: string
  value: string
  external?: boolean
}) {
  return (
    <a
      className="tx-contact-card"
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <span className={`tx-contact-icon tx-contact-icon--${icon}`}>
        <Icon name={icon} />
      </span>
      <span className="tx-contact-copy">
        <span>{label}</span>
        <strong dir={icon === 'phone' || icon === 'mail' ? 'ltr' : undefined}>{value}</strong>
      </span>
      {external && <Icon className="tx-contact-external" name="arrow-up" />}
    </a>
  )
}

export function TransportationCompanyDetailPage() {
  const { slug = '' } = useParams()
  const company = useQuery({
    queryKey: ['transport-company', slug],
    queryFn: ({ signal }) =>
      apiGet<TransportCompanyDetail>(
        `/v1/transport-companies/${encodeURIComponent(slug)}/`,
        undefined,
        signal,
      ),
    enabled: Boolean(slug),
    retry: false,
  })

  const item = company.data
  useDocumentTitle(item?.name, 'پروفایل شرکت حمل‌ونقل | کارفنسا')

  const primary = item?.transport_types[0]
  const place = useMemo(
    () => (item ? joinPlace(item.province?.name_fa, item.city?.name_fa) : ''),
    [item],
  )
  const international = Boolean(item?.origin_countries.length || item?.destination_countries.length)
  const domestic = Boolean(item?.service_provinces.length || item?.province)
  const services = useMemo(() => {
    if (!item) return []
    const rows: Array<{ code: string; title: string; body: string; type: string }> =
      item.transport_types.map((mode) => ({
        code: mode.code,
        title: mode.name_fa,
        body: transportCategoryTitle(mode.code, mode.name_fa),
        type: 'حوزه حمل‌ونقل',
      }))
    if (item.tracking_available) {
      rows.push({
        code: 'international',
        title: 'ردیابی محموله',
        body: 'امکان پیگیری وضعیت بار در این شرکت ثبت شده است.',
        type: 'خدمت عملیاتی',
      })
    }
    if (item.insurance_available) {
      rows.push({
        code: 'warehouse',
        title: 'بیمه بار',
        body: 'خدمات بیمه بار در پروفایل این شرکت فعال است.',
        type: 'خدمت عملیاتی',
      })
    }
    if (item.customs_services) {
      rows.push({
        code: 'customs',
        title: 'ترخیص و خدمات گمرکی',
        body: 'خدمات گمرکی در پروفایل این شرکت فعال است.',
        type: 'خدمت عملیاتی',
      })
    }
    return rows
  }, [item])

  const tabs = [
    { id: 'about', label: 'معرفی شرکت' },
    ...(services.length ? [{ id: 'services', label: 'خدمات حمل‌ونقل' }] : []),
    ...(item &&
    (item.service_provinces.length ||
      item.origin_countries.length ||
      item.destination_countries.length)
      ? [{ id: 'routes', label: 'مسیرهای فعالیت' }]
      : []),
    ...(item && (item.fleet_capacity || item.vehicle_types.length)
      ? [{ id: 'fleet', label: 'ناوگان و تجهیزات' }]
      : []),
    { id: 'contact', label: 'ارتباط و همکاری' },
  ]
  const { activeId, scrollTo } = useSectionNavigation(tabs.map((tab) => tab.id))

  if (company.isLoading) {
    return (
      <section className="kd-page tx-detail" dir="rtl">
        <DetailPageSkeleton />
      </section>
    )
  }

  if (company.isError || !item) {
    const notFound = company.error instanceof ApiError && company.error.status === 404
    return (
      <section className="kd-page tx-detail" dir="rtl">
        <Breadcrumb
          items={[{ label: 'حمل‌ونقل', to: '/transportation/companies' }, { label: 'پروفایل' }]}
        />
        {notFound ? (
          <DirectoryEmpty
            title="شرکت حمل‌ونقل پیدا نشد"
            body="این پروفایل در فهرست عمومی وجود ندارد یا دیگر فعال نیست."
            action={
              <Link className="dir-button" to="/transportation/companies">
                بازگشت به دایرکتوری
              </Link>
            }
          />
        ) : (
          <DirectoryError
            title="بارگذاری پروفایل انجام نشد"
            message={
              company.error instanceof ApiError
                ? company.error.message
                : 'ارتباط با سرور برقرار نشد.'
            }
            onRetry={() => void company.refetch()}
          />
        )}
      </section>
    )
  }

  const phone = phoneHref(item.phone)
  const mobile = phoneHref(item.mobile)
  const email = emailHref(item.email)
  const telegram = telegramHref(item.telegram)
  const instagram = instagramHref(item.instagram)
  const website = websiteHref(item.website)
  const hasContact = Boolean(phone || mobile || email || telegram || instagram)
  const coverageValue = [domestic ? 'داخلی' : '', international ? 'بین‌المللی' : '']
    .filter(Boolean)
    .join(' و ')

  return (
    <section className="kd-page tx-detail" dir="rtl">
      <Breadcrumb
        items={[{ label: 'حمل‌ونقل', to: '/transportation/companies' }, { label: item.name }]}
      />

      <header className="tx-corporate-hero">
        <div className="tx-corporate-cover">
          {item.cover_image && <img src={item.cover_image} alt="" fetchPriority="high" />}
          <span className="tx-cover-caption">حمل‌ونقل و لجستیک</span>
        </div>
        <div className="tx-corporate-panel">
          <div className="tx-corporate-mark">
            {item.logo ? <img src={item.logo} alt="" /> : item.name.trim().slice(0, 1) || 'ک'}
          </div>
          <div className="tx-corporate-meta">
            {primary && <span className="tx-corporate-specialty">{primary.name_fa}</span>}
            {item.is_verified && (
              <span className="tx-corporate-verified">
                <Icon name="badge-check" />
                تأییدشده
              </span>
            )}
          </div>
          <h1>{item.name}</h1>
          {item.english_name && <p className="tx-corporate-english">{item.english_name}</p>}
          {place && (
            <p className="tx-corporate-place">
              <Icon name="pin" />
              {place}
            </p>
          )}
          {item.description && (
            <p className="tx-corporate-lead">
              {item.description.length > 180
                ? `${item.description.slice(0, 180)}…`
                : item.description}
            </p>
          )}
          <div className="tx-corporate-actions">
            <button className="dir-button" type="button" onClick={() => scrollTo('contact')}>
              ارتباط با شرکت
            </button>
            <ShareButton title={item.name} />
          </div>
        </div>
      </header>

      <ProfileQuickFacts
        items={[
          { label: 'نوع فعالیت', value: 'شرکت حمل‌ونقل' },
          { label: 'حوزه اصلی', value: primary?.name_fa || '' },
          { label: 'استان و شهر', value: place },
          { label: 'پوشش', value: coverageValue },
          { label: 'وضعیت اعتبارسنجی', value: item.is_verified ? 'تأییدشده' : '' },
        ]}
      />

      <ProfileSectionTabs tabs={tabs} activeId={activeId} onSelect={scrollTo} />

      <div className="kd-layout tx-detail-layout">
        <div className="kd-main">
          <ResponsiveSection id="about" title="معرفی شرکت">
            <p className="kd-prose">{item.description || 'توضیحی برای این شرکت ثبت نشده است.'}</p>
            <div className="tx-company-info">
              {item.address && (
                <div>
                  <Icon name="pin" />
                  <span>
                    <strong>نشانی ثبت‌شده</strong>
                    <span>{item.address}</span>
                  </span>
                </div>
              )}
              {place && (
                <div>
                  <Icon name="building" />
                  <span>
                    <strong>استان و شهر</strong>
                    <span>{place}</span>
                  </span>
                </div>
              )}
              {website && (
                <div>
                  <Icon name="globe" />
                  <span>
                    <strong>وب‌سایت</strong>
                    <a href={website} target="_blank" rel="noopener noreferrer">
                      {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </span>
                  <Icon name="arrow-up" />
                </div>
              )}
            </div>
          </ResponsiveSection>

          {services.length > 0 && (
            <ResponsiveSection id="services" title="خدمات حمل‌ونقل" count={services.length}>
              <div className="tx-services">
                {services.map((service) => (
                  <article className="tx-service" key={`${service.type}-${service.title}`}>
                    <img src={transportCategoryIcon(service.code)} alt="" width={48} height={48} />
                    <div>
                      <strong>{service.title}</strong>
                      <p className="kd-card-note tx-service-note">{service.body}</p>
                      <span className="dir-chip">{service.type}</span>
                    </div>
                  </article>
                ))}
              </div>
            </ResponsiveSection>
          )}

          {(item.service_provinces.length > 0 ||
            item.origin_countries.length > 0 ||
            item.destination_countries.length > 0) && (
            <ResponsiveSection id="routes" title="مسیرهای فعالیت">
              {item.service_provinces.length > 0 && (
                <div className="tx-subblock">
                  <h3 className="tx-subtitle">استان‌های تحت پوشش</h3>
                  <div className="tx-chips">
                    {item.service_provinces.map((province) => (
                      <span className="dir-chip" key={province.slug}>
                        {province.name_fa}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(item.origin_countries.length > 0 || item.destination_countries.length > 0) && (
                <div className="tx-subblock">
                  <h3 className="tx-subtitle">مسیر بین‌المللی</h3>
                  <article className="tx-route">
                    <div>
                      <strong>مبدأ</strong>
                      <p>{item.origin_countries.map((country) => country.name_fa).join('، ')}</p>
                    </div>
                    <span className="line" aria-hidden="true" />
                    <div>
                      <strong>مقصد</strong>
                      <p>
                        {item.destination_countries.map((country) => country.name_fa).join('، ')}
                      </p>
                    </div>
                  </article>
                </div>
              )}
            </ResponsiveSection>
          )}

          {(item.fleet_capacity || item.vehicle_types.length > 0) && (
            <ResponsiveSection id="fleet" title="ناوگان و تجهیزات">
              {item.fleet_capacity && <p className="kd-prose">{item.fleet_capacity}</p>}
              {item.vehicle_types.length > 0 && (
                <div className="tx-chips">
                  {item.vehicle_types.map((vehicle) => (
                    <span className="dir-chip" key={vehicle.slug}>
                      {vehicle.name_fa}
                    </span>
                  ))}
                </div>
              )}
            </ResponsiveSection>
          )}

          <ResponsiveSection id="contact" title="ارتباط و درخواست همکاری">
            <div className="tx-contact-section">
              <p>
                برای دریافت مشاوره، استعلام خدمات یا پیشنهاد همکاری، از راه‌های ارتباطی ثبت‌شده شرکت
                استفاده کنید.
              </p>
              {hasContact ? (
                <div className="tx-contact-grid">
                  {phone && (
                    <ContactCard href={phone} icon="phone" label="تلفن شرکت" value={item.phone} />
                  )}
                  {mobile && (
                    <ContactCard
                      href={mobile}
                      icon="phone"
                      label="تلفن همراه"
                      value={item.mobile}
                    />
                  )}
                  {email && (
                    <ContactCard href={email} icon="mail" label="ایمیل" value={item.email} />
                  )}
                  {telegram && (
                    <ContactCard
                      href={telegram}
                      icon="send"
                      label="تلگرام"
                      value={item.telegram}
                      external
                    />
                  )}
                  {instagram && (
                    <ContactCard
                      href={instagram}
                      icon="instagram"
                      label="اینستاگرام"
                      value={item.instagram}
                      external
                    />
                  )}
                </div>
              ) : (
                <div className="tx-contact-empty">
                  <Icon name="phone" />
                  <span>راه ارتباطی مستقیمی برای این شرکت ثبت نشده است.</span>
                </div>
              )}
            </div>
          </ResponsiveSection>
        </div>
      </div>

      <section className="tx-cooperation" aria-labelledby="tx-cooperation-title">
        <div>
          <p>همکاری مستقیم و شفاف</p>
          <h2 id="tx-cooperation-title">آماده شروع همکاری هستید؟</h2>
          <span>از راه‌های ارتباطی ثبت‌شده شرکت برای گفت‌وگو درباره همکاری استفاده کنید.</span>
        </div>
        <button className="dir-button" type="button" onClick={() => scrollTo('contact')}>
          ارتباط با شرکت
          <Icon name="arrow-l" />
        </button>
      </section>

      {hasContact && (
        <div className="tx-mobile-cta">
          <div>
            <strong>{item.name}</strong>
            {place && <span>{place}</span>}
          </div>
          <button className="dir-button" type="button" onClick={() => scrollTo('contact')}>
            ارتباط با شرکت
          </button>
        </div>
      )}
    </section>
  )
}
