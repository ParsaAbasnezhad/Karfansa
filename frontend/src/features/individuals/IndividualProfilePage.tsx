import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
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
  ProductMiniGrid,
  ProfileHero,
  ProfileQuickFacts,
  ProfileSectionTabs,
  ProfileStats,
  ResponsiveSection,
  ShareButton,
  firstAvailableListing,
  joinPlace,
  useDocumentTitle,
  useSectionNavigation,
} from '@/features/directory/detail-shared'
import type { IndividualCard } from './types'

const SECTION_TABS = [
  { id: 'about', label: 'درباره فعال اقتصادی' },
  { id: 'products', label: 'محصولات و خدمات' },
  { id: 'contact', label: 'ارتباط و همکاری' },
] as const

const SECTION_IDS = SECTION_TABS.map((tab) => tab.id)

export function IndividualProfilePage() {
  const { individualId = '' } = useParams()
  const { activeId, scrollTo } = useSectionNavigation(SECTION_IDS)

  const profile = useQuery({
    queryKey: ['individuals', 'detail', individualId],
    queryFn: ({ signal }) =>
      apiGet<IndividualCard>(`/v1/individuals/${encodeURIComponent(individualId)}/`, undefined, signal),
    enabled: Boolean(individualId),
    retry: false,
  })
  const products = useQuery({
    queryKey: ['individuals', 'products', individualId],
    queryFn: ({ signal }) =>
      apiGet<ProductListingPage>(
        '/v1/services/listings/',
        { seller: individualId, listing_kind: 'product', page_size: 24 },
        signal,
      ),
    enabled: Boolean(individualId),
  })
  const services = useQuery({
    queryKey: ['individuals', 'services', individualId],
    queryFn: ({ signal }) =>
      apiGet<ProductListingPage>(
        '/v1/services/listings/',
        { seller: individualId, listing_kind: 'service', page_size: 24 },
        signal,
      ),
    enabled: Boolean(individualId),
  })

  const item = profile.data
  useDocumentTitle(item?.display_name, 'پروفایل فعال اقتصادی | کارفنسا')

  const place = useMemo(() => {
    if (!item) return ''
    return joinPlace(item.province_name, item.city_name)
  }, [item])

  const firstListing = firstAvailableListing(products.data, services.data)
  const productCount = products.data?.count ?? products.data?.results.length ?? 0
  const serviceCount = services.data?.count ?? services.data?.results.length ?? 0
  const listingItems = [...(products.data?.results ?? []), ...(services.data?.results ?? [])]
  const activeListings = item?.listings_count ?? productCount + serviceCount

  if (profile.isLoading) {
    return (
      <section className="kd-page" dir="rtl">
        <DetailPageSkeleton />
      </section>
    )
  }

  if (profile.isError || !item) {
    const notFound = profile.error instanceof ApiError && profile.error.status === 404
    return (
      <section className="kd-page" dir="rtl">
        <Breadcrumb items={[{ label: 'فعالان فردی', to: '/individuals' }, { label: 'پروفایل' }]} />
        <DirectoryError
          message={
            notFound
              ? 'این پروفایل پیدا نشد یا عمومی نیست.'
              : profile.error instanceof ApiError
                ? profile.error.message
                : 'بارگذاری پروفایل ممکن نشد.'
          }
        />
        <Link className="dir-button" to="/individuals" style={{ marginTop: 16 }}>
          بازگشت به فهرست
        </Link>
      </section>
    )
  }

  const lead = item.bio
    ? item.bio.length > 150
      ? `${item.bio.slice(0, 150)}…`
      : item.bio
    : null

  return (
    <section className="kd-page" dir="rtl">
      <Breadcrumb
        items={[{ label: 'فعالان فردی', to: '/individuals' }, { label: item.display_name }]}
      />

      <ProfileHero
        variant="person"
        coverImage={item.cover_image}
        markSrc={item.profile_image}
        markLabel={item.display_name}
        verified={item.is_verified}
        title={item.display_name}
        subtitle={item.professional_title || null}
        place={place || null}
        lead={lead}
        chips={<span className="kd-chip">{formatNumber(activeListings)} آگهی عمومی</span>}
        actions={
          <>
            {firstListing ? (
              <Link className="dir-button" to={`/services/listings/${encodeURIComponent(firstListing.slug)}`}>
                شروع ارتباط
              </Link>
            ) : (
              <Link className="dir-button is-soft" to="/services/listings">
                بازار محصولات
              </Link>
            )}
            <ShareButton title={item.display_name} />
          </>
        }
      />

      <ProfileQuickFacts
        items={[
          { label: 'حوزه تخصص', value: item.professional_title || '' },
          { label: 'موقعیت', value: place },
          {
            label: 'محصولات فعال',
            value: products.data && productCount > 0 ? formatNumber(productCount) : '',
          },
          {
            label: 'خدمات فعال',
            value: services.data && serviceCount > 0 ? formatNumber(serviceCount) : '',
          },
          {
            label: 'آگهی‌های عمومی',
            value: formatNumber(activeListings),
          },
        ]}
      />

      <ProfileSectionTabs tabs={[...SECTION_TABS]} activeId={activeId} onSelect={scrollTo} />

      <div className="kd-layout">
        <div className="kd-main">
          <ResponsiveSection id="about" title="درباره فعال اقتصادی">
            <p className="kd-prose">
              {item.bio || 'معرفی عمومی برای این پروفایل ثبت نشده است.'}
            </p>
            {(productCount > 0 || serviceCount > 0 || activeListings > 0) && (
              <ProfileStats
                items={[
                  ...(productCount > 0 ? [{ label: 'محصولات', value: productCount }] : []),
                  ...(serviceCount > 0 ? [{ label: 'خدمات', value: serviceCount }] : []),
                  { label: 'آگهی‌های عمومی', value: activeListings },
                ]}
              />
            )}
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
                title="آگهی منتشر نشده"
                body="هنوز محصول یا خدمت تأییدشده‌ای برای این پروفایل منتشر نشده است."
              />
            )}
          </ResponsiveSection>

          <ResponsiveSection id="contact" title="ارتباط و همکاری">
            <p className="kd-card-note" style={{ margin: 0 }}>
              اطلاعات حساب کاربری، مدارک هویتی و شماره تماس خصوصی نمایش داده نمی‌شوند. برای گفتگو، از فرم درخواست روی یکی از آگهی‌های منتشرشده استفاده کنید.
            </p>
            {firstListing && (
              <Link className="dir-button" to={`/services/listings/${encodeURIComponent(firstListing.slug)}`}>
                رفتن به آگهی و ثبت درخواست
              </Link>
            )}
          </ResponsiveSection>
        </div>

        <div className="kd-sidebar">
          <BusinessContactCard
            title="ارتباط با فعال اقتصادی"
            verified={item.is_verified}
            place={place || null}
            note="ارتباط از طریق سیستم درخواست کارفنسا انجام می‌شود."
            primaryAction={
              firstListing ? (
                <Link className="dir-button" to={`/services/listings/${encodeURIComponent(firstListing.slug)}`}>
                  ارسال درخواست همکاری
                </Link>
              ) : (
                <Link className="dir-button is-soft" to="/services/listings">
                  مشاهده بازار محصولات
                </Link>
              )
            }
          />
        </div>
      </div>
    </section>
  )
}
