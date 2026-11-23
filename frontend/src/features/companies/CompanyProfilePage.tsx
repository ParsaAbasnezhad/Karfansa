import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiGet } from '@/lib/api-client'
import { jalaliYear } from '@/lib/format'
import type { ProductListingPage } from '@/features/services/types'
import {
  Breadcrumb,
  DirectoryEmpty,
  DirectoryError,
  DirectorySkeleton,
} from '@/features/directory/shared'
import {
  BusinessContactCard,
  DetailPageSkeleton,
  OpportunityMiniGrid,
  ProductMiniGrid,
  ProfileHero,
  ProfileQuickFacts,
  ProfileSectionTabs,
  ProfileStats,
  ResponsiveSection,
  ShareButton,
  buildSocialLinks,
  firstAvailableListing,
  joinPlace,
  useDocumentTitle,
  useSectionNavigation,
} from '@/features/directory/detail-shared'
import type { CompanyDetail } from './types'

type OpportunityPage = {
  results: Array<{
    id: number
    title: string
    slug: string
    opportunity_type: string
    opportunity_type_display: string
    province_name_fa: string
    description: string
    valid_until?: string | null
  }>
  count: number
}

const SECTION_TABS = [
  { id: 'about', label: 'معرفی شرکت' },
  { id: 'products', label: 'محصولات و خدمات' },
  { id: 'trade', label: 'فرصت‌های تجاری' },
  { id: 'stats', label: 'اطلاعات و فعالیت‌ها' },
  { id: 'contact', label: 'تماس و همکاری' },
] as const

const SECTION_IDS = SECTION_TABS.map((tab) => tab.id)

export function CompanyProfilePage() {
  const { slug = '' } = useParams()
  const { activeId, scrollTo } = useSectionNavigation(SECTION_IDS)

  const company = useQuery({
    queryKey: ['organizations', 'detail', slug],
    queryFn: ({ signal }) =>
      apiGet<CompanyDetail>(`/v1/organizations/${encodeURIComponent(slug)}/`, undefined, signal),
    enabled: Boolean(slug),
    retry: false,
  })
  const products = useQuery({
    queryKey: ['organizations', 'products', slug],
    queryFn: ({ signal }) =>
      apiGet<ProductListingPage>(
        '/v1/services/listings/',
        { organization: slug, listing_kind: 'product', page_size: 12 },
        signal,
      ),
    enabled: Boolean(slug),
  })
  const services = useQuery({
    queryKey: ['organizations', 'services', slug],
    queryFn: ({ signal }) =>
      apiGet<ProductListingPage>(
        '/v1/services/listings/',
        { organization: slug, listing_kind: 'service', page_size: 12 },
        signal,
      ),
    enabled: Boolean(slug),
  })
  const opportunities = useQuery({
    queryKey: ['organizations', 'trade', slug],
    queryFn: ({ signal }) =>
      apiGet<OpportunityPage>('/v1/trade/opportunities/', { company: slug, page_size: 12 }, signal),
    enabled: Boolean(slug),
  })

  const item = company.data
  useDocumentTitle(item?.name, 'پروفایل شرکت | کارفنسا')

  const place = useMemo(() => {
    if (!item) return ''
    return joinPlace(item.province?.name_fa, item.city?.name_fa)
  }, [item])

  const firstListing = firstAvailableListing(products.data, services.data)
  const productCount = products.data?.count ?? products.data?.results.length ?? 0
  const serviceCount = services.data?.count ?? services.data?.results.length ?? 0
  const tradeCount = opportunities.data?.count ?? opportunities.data?.results.length ?? 0
  const listingItems = [...(products.data?.results ?? []), ...(services.data?.results ?? [])]

  if (company.isLoading) {
    return (
      <section className="kd-page" dir="rtl">
        <DetailPageSkeleton />
      </section>
    )
  }

  if (company.isError || !item) {
    const notFound = company.error instanceof ApiError && company.error.status === 404
    return (
      <section className="kd-page" dir="rtl">
        <Breadcrumb items={[{ label: 'شرکت‌ها', to: '/companies' }, { label: 'پروفایل' }]} />
        <DirectoryError
          message={
            notFound
              ? 'این شرکت پیدا نشد یا در فهرست عمومی قابل نمایش نیست.'
              : company.error instanceof ApiError
                ? company.error.message
                : 'بارگذاری پروفایل شرکت ممکن نشد.'
          }
        />
        <Link className="dir-button" to="/companies" style={{ marginTop: 16 }}>
          بازگشت به فهرست شرکت‌ها
        </Link>
      </section>
    )
  }

  const established =
    item.established_at && !Number.isNaN(Date.parse(item.established_at))
      ? jalaliYear(item.established_at)
      : item.established_at || ''

  const socials = buildSocialLinks({
    linkedin: item.linkedin,
    instagram: item.instagram,
    telegram: item.telegram,
    whatsapp: item.whatsapp,
  })

  const lead = item.description
    ? item.description.length > 160
      ? `${item.description.slice(0, 160)}…`
      : item.description
    : null

  return (
    <section className="kd-page" dir="rtl">
      <Breadcrumb items={[{ label: 'شرکت‌ها', to: '/companies' }, { label: item.name }]} />

      <ProfileHero
        variant="company"
        coverImage={item.cover_image}
        markSrc={item.logo}
        markLabel={item.name}
        verified={item.is_verified}
        title={item.name}
        subtitle={item.english_name || null}
        place={place || null}
        lead={lead}
        chips={
          <>
            <span className="kd-chip kd-chip--blue">{item.organization_type_display}</span>
            {item.industry && <span className="kd-chip">{item.industry.name_fa}</span>}
          </>
        }
        actions={
          <>
            {firstListing ? (
              <Link className="dir-button" to={`/services/listings/${encodeURIComponent(firstListing.slug)}`}>
                درخواست همکاری
              </Link>
            ) : (
              <Link className="dir-button is-soft" to="/services/listings">
                بازار محصولات
              </Link>
            )}
            <ShareButton title={item.name} />
          </>
        }
      />

      <ProfileQuickFacts
        items={[
          { label: 'سال تأسیس', value: established },
          { label: 'نوع شرکت', value: item.organization_type_display },
          { label: 'استان و شهر', value: place },
          { label: 'حوزه فعالیت', value: item.industry?.name_fa || '' },
          {
            label: 'وضعیت اعتبارسنجی',
            value: item.is_verified ? 'تأییدشده' : '',
          },
        ]}
      />

      <ProfileSectionTabs
        tabs={[...SECTION_TABS]}
        activeId={activeId}
        onSelect={scrollTo}
      />

      <div className="kd-layout">
        <div className="kd-main">
          <ResponsiveSection id="about" title="درباره شرکت">
            <p className="kd-prose">
              {item.description || 'توضیحی برای این شرکت ثبت نشده است.'}
            </p>
          </ResponsiveSection>

          <ResponsiveSection
            id="products"
            title="محصولات و خدمات"
            count={productCount + serviceCount}
          >
            {products.isLoading || services.isLoading ? (
              <DirectorySkeleton count={3} />
            ) : listingItems.length ? (
              <ProductMiniGrid items={listingItems} />
            ) : (
              <DirectoryEmpty
                title="محصول یا خدمتی منتشر نشده"
                body="این شرکت هنوز آگهی تأییدشده‌ای در بازار کارفنسا ندارد."
              />
            )}
          </ResponsiveSection>

          <ResponsiveSection id="trade" title="فرصت‌های تجاری" count={tradeCount}>
            {opportunities.isLoading ? (
              <DirectorySkeleton count={2} />
            ) : opportunities.data?.results.length ? (
              <OpportunityMiniGrid items={opportunities.data.results} />
            ) : (
              <DirectoryEmpty
                title="فرصت تجاری فعالی نیست"
                body="فرصت‌های تأییدشده و منتشرشده این شرکت اینجا نمایش داده می‌شوند."
              />
            )}
          </ResponsiveSection>

          <ResponsiveSection id="stats" title="اطلاعات و فعالیت‌ها">
            <ProfileStats
              items={[
                { label: 'محصولات', value: productCount },
                { label: 'خدمات', value: serviceCount },
                { label: 'فرصت‌های فعال', value: tradeCount },
              ]}
            />
          </ResponsiveSection>

          <ResponsiveSection id="contact" title="تماس و همکاری">
            <p className="kd-card-note" style={{ margin: 0 }}>
              برای حفظ حریم خصوصی، ارتباط مستقیم از طریق درخواست روی محصولات و خدمات منتشرشده انجام می‌شود.
            </p>
            {firstListing && (
              <Link className="dir-button" to={`/services/listings/${encodeURIComponent(firstListing.slug)}`}>
                ثبت درخواست روی آگهی
              </Link>
            )}
          </ResponsiveSection>
        </div>

        <div className="kd-sidebar">
          <BusinessContactCard
            verified={item.is_verified}
            place={place || null}
            address={item.address || null}
            website={item.website || null}
            socials={socials}
            note="اطلاعات تماس خصوصی و مدارک محرمانه نمایش داده نمی‌شوند."
            primaryAction={
              firstListing ? (
                <Link className="dir-button" to={`/services/listings/${encodeURIComponent(firstListing.slug)}`}>
                  ارسال پیام / درخواست
                </Link>
              ) : (
                <Link className="dir-button is-soft" to="/services/listings">
                  مشاهده بازار محصولات
                </Link>
              )
            }
            secondaryAction={
              item.website ? (
                <a className="dir-button is-ghost" href={item.website} target="_blank" rel="noreferrer">
                  وب‌سایت شرکت
                </a>
              ) : undefined
            }
          />
        </div>
      </div>
    </section>
  )
}
