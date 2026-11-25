import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { apiGet } from '@/lib/api-client'
import { formatNumber, formatShortDate } from '@/lib/format'
import { InquiryActions } from '@/features/inquiries/InquiryActions'
import {
  Breadcrumb,
  DirectoryEmpty,
  DirectoryError,
  DirectorySkeleton,
} from '@/features/directory/shared'
import {
  DetailFactsList,
  DetailPageSkeleton,
  OpportunityActionCard,
  OpportunityMiniGrid,
  OpportunityStatusBadge,
  OpportunitySummary,
  OpportunityTypePill,
  ProfileHero,
  PublisherCard,
  ResponsiveSection,
  ShareButton,
  isOpportunityActive,
  joinPlace,
  useDocumentTitle,
  useSectionNavigation,
} from '@/features/directory/detail-shared'
import type { TradeOpportunity, TradeOpportunityPage } from './types'
import './trade-detail.css'

const SECTION_TABS = [
  { id: 'description', label: 'شرح فرصت' },
  { id: 'details', label: 'جزئیات تجاری' },
  { id: 'publisher', label: 'منتشرکننده' },
  { id: 'related', label: 'فرصت‌های مرتبط' },
] as const

const SECTION_IDS = SECTION_TABS.map((tab) => tab.id)

export function TradeOpportunityDetailPage() {
  const { slug = '' } = useParams()
  const { activeId, scrollTo } = useSectionNavigation(SECTION_IDS)

  const opportunity = useQuery({
    queryKey: ['trade-opportunity', slug],
    queryFn: ({ signal }) =>
      apiGet<TradeOpportunity>(
        `/v1/trade/opportunities/${encodeURIComponent(slug)}/`,
        undefined,
        signal,
      ),
    enabled: Boolean(slug),
  })

  const item = opportunity.data
  const active = item ? isOpportunityActive(item) : false
  const place = item ? joinPlace(item.province_name_fa, item.city_name_fa) : ''

  const related = useQuery({
    queryKey: ['trade-opportunity', 'related', slug, item?.industry_slug, item?.province_slug],
    queryFn: ({ signal }) =>
      apiGet<TradeOpportunityPage>(
        '/v1/trade/opportunities/',
        {
          industry: item?.industry_slug || undefined,
          province: item?.industry_slug ? undefined : item?.province_slug,
          page_size: 6,
        },
        signal,
      ),
    enabled: Boolean(item) && Boolean(item?.industry_slug || item?.province_slug),
  })

  useDocumentTitle(item?.title, 'فرصت تجاری | کارفنسا')

  if (opportunity.isPending) {
    return (
      <section className="kd-page trade-detail" dir="rtl">
        <DetailPageSkeleton />
      </section>
    )
  }

  if (opportunity.isError || !item) {
    return (
      <section className="kd-page trade-detail" dir="rtl">
        <Breadcrumb items={[{ label: 'فرصت‌های تجاری', to: '/trade' }, { label: 'جزئیات' }]} />
        <DirectoryError
          title="فرصت تجاری پیدا نشد"
          message="ممکن است فرصت منقضی شده یا انتشار آن متوقف شده باشد."
        />
        <AppLink className="dir-button" href="/trade/" style={{ marginTop: 16 }}>
          بازگشت به فرصت‌های تجاری
        </AppLink>
      </section>
    )
  }

  const volumeLabel =
    item.required_volume != null && item.required_volume !== ''
      ? `${formatNumber(Number(item.required_volume))} ${item.volume_unit}`.trim()
      : ''

  const valueLabel =
    item.min_value && item.max_value
      ? `${formatNumber(Number(item.min_value))} تا ${formatNumber(Number(item.max_value))} ${item.currency}`
      : item.min_value
        ? `از ${formatNumber(Number(item.min_value))} ${item.currency}`
        : item.max_value
          ? `تا ${formatNumber(Number(item.max_value))} ${item.currency}`
          : ''

  const primaryHref = item.service_listing_slug
    ? `/services/listings/${encodeURIComponent(item.service_listing_slug)}`
    : item.company
      ? `/companies/${encodeURIComponent(item.company.slug)}`
      : null

  const primaryLabel = item.service_listing_slug
    ? 'مشاهده محصول مرتبط'
    : item.company
      ? 'مشاهده پروفایل شرکت'
      : 'مشاهده فرصت'

  const primaryDisabledReason = !primaryHref
    ? 'برای این فرصت مسیر درخواست عمومی در دسترس نیست. با فهرست فرصت‌ها یا پشتیبانی کارفنسا ادامه دهید.'
    : undefined

  const publisherHref = item.company
    ? `/companies/${encodeURIComponent(item.company.slug)}`
    : null

  const relatedItems =
    related.data?.results.filter((entry) => entry.slug !== item.slug).slice(0, 4) ?? []

  return (
    <article className="kd-page trade-detail" dir="rtl">
      <Breadcrumb
        items={[
          { label: 'فرصت‌های تجاری', to: '/trade' },
          { label: item.title },
        ]}
      />

      <ProfileHero
        variant="opportunity"
        markLabel={item.title}
        title={item.title}
        place={place || null}
        chips={
          <>
            <OpportunityTypePill type={item.opportunity_type} label={item.opportunity_type_display} />
            {item.industry_name_fa && <span className="kd-chip">{item.industry_name_fa}</span>}
            <OpportunityStatusBadge active={active} />
          </>
        }
        lead={
          [
            item.published_at ? `انتشار: ${formatShortDate(item.published_at)}` : '',
            item.valid_until ? `اعتبار تا ${formatShortDate(item.valid_until)}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || null
        }
        actions={<ShareButton title={item.title} />}
      />

      <OpportunitySummary
        items={[
          { label: 'نوع فرصت', value: item.opportunity_type_display },
          {
            label: 'محصول یا خدمت',
            value: item.product_name_fa || (item.service_listing_slug ? 'خدمت مرتبط' : ''),
          },
          { label: 'بازار هدف', value: item.target_market || '' },
          { label: 'موقعیت جغرافیایی', value: place },
          { label: 'میزان / ارزش معامله', value: valueLabel || volumeLabel },
          {
            label: 'مهلت اعتبار',
            value: item.valid_until ? formatShortDate(item.valid_until) : '',
          },
        ]}
      />

      <div className="kd-tabs-wrap">
        <div className="kd-tabs" role="tablist" aria-label="بخش‌های فرصت">
          {SECTION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeId === tab.id}
              onClick={() => scrollTo(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kd-layout">
        <div className="kd-main">
          <ResponsiveSection id="description" title="شرح فرصت">
            <p className="kd-prose">{item.description}</p>
          </ResponsiveSection>

          <ResponsiveSection id="details" title="جزئیات تجاری">
            <DetailFactsList
              items={[
                { label: 'نوع همکاری', value: item.opportunity_type_display },
                { label: 'محصول', value: item.product_name_fa },
                { label: 'صنعت', value: item.industry_name_fa },
                { label: 'بازار هدف', value: item.target_market },
                { label: 'مقدار و واحد', value: volumeLabel },
                { label: 'ارزش معامله', value: valueLabel },
                { label: 'موقعیت جغرافیایی', value: place },
                {
                  label: 'استان',
                  value: (
                    <AppLink href={`/provinces/${encodeURIComponent(item.province_slug)}/`}>
                      {item.province_name_fa}
                    </AppLink>
                  ),
                },
                {
                  label: 'تاریخ انتشار',
                  value: item.published_at ? (
                    <time dateTime={item.published_at}>{formatShortDate(item.published_at)}</time>
                  ) : null,
                },
                {
                  label: 'اعتبار تا',
                  value: item.valid_until ? (
                    <time dateTime={item.valid_until}>{formatShortDate(item.valid_until)}</time>
                  ) : null,
                },
                {
                  label: 'منبع',
                  value: item.source
                    ? item.source_url
                      ? (
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                            {item.source}
                          </a>
                        )
                      : item.source
                    : null,
                },
              ]}
            />
          </ResponsiveSection>

          <ResponsiveSection id="publisher" title="اطلاعات منتشرکننده">
            {item.company ? (
              <PublisherCard
                name={item.company.name}
                href={`/companies/${encodeURIComponent(item.company.slug)}`}
                meta="شرکت · هویت حقوقی"
              />
            ) : (
              <DirectoryEmpty
                title="منتشرکننده عمومی ثبت نشده"
                body="این فرصت بدون پروفایل شرکت عمومی منتشر شده است."
              />
            )}
          </ResponsiveSection>

          <ResponsiveSection id="related" title="فرصت‌های مرتبط">
            {related.isLoading ? (
              <DirectorySkeleton count={2} />
            ) : relatedItems.length ? (
              <OpportunityMiniGrid items={relatedItems} />
            ) : (
              <DirectoryEmpty
                title="فرصت مرتبطی یافت نشد"
                body="در حال حاضر فرصت مشابه دیگری برای نمایش وجود ندارد."
              />
            )}
          </ResponsiveSection>
        </div>

        <div className="kd-sidebar">
          {active && item.inquiry_available && <InquiryActions key={item.slug} targetType="trade" slug={item.slug} title={item.title} ownerName={item.company?.name || 'منتشرکننده فرصت'} />}
          <OpportunityActionCard
            active={active}
            validUntil={item.valid_until}
            primaryHref={active ? primaryHref : null}
            primaryLabel={primaryLabel}
            primaryDisabledReason={primaryDisabledReason}
            publisherHref={publisherHref}
            publisherLabel={item.company ? 'مشاهده پروفایل منتشرکننده' : undefined}
          />

          {item.service_listing_slug && (
            <aside className="kd-card">
              <h2 className="kd-card-title">محصول مرتبط</h2>
              <Link
                className="dir-button is-soft"
                to={`/services/listings/${encodeURIComponent(item.service_listing_slug)}`}
              >
                مشاهده محصول مرتبط
              </Link>
            </aside>
          )}
        </div>
      </div>

      <div className="kd-mobile-cta">
        {active && primaryHref ? (
          <Link className="dir-button" to={primaryHref}>
            {primaryLabel}
          </Link>
        ) : (
          <button className="dir-button" type="button" disabled>
            {primaryLabel}
          </button>
        )}
      </div>

      <AppLink className="trade-detail-back" href="/trade/">
        مشاهده همه فرصت‌های تجاری
      </AppLink>
    </article>
  )
}
