import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { apiGet } from '@/lib/api-client'
import { formatNumber, formatShortDate } from '@/lib/format'
import { TradeTypeIcon } from './TradeArt'
import type { TradeOpportunity } from './types'
import './trade-detail.css'

export function TradeOpportunityDetailPage() {
  const { slug = '' } = useParams()
  const opportunity = useQuery({
    queryKey: ['trade-opportunity', slug],
    queryFn: ({ signal }) => apiGet<TradeOpportunity>(`/v1/trade/opportunities/${encodeURIComponent(slug)}/`, undefined, signal),
    enabled: Boolean(slug),
  })

  useEffect(() => {
    document.title = opportunity.data?.title
      ? `${opportunity.data.title} | فرصت‌های تجاری کارفنسا`
      : 'فرصت تجاری | کارفنسا'
  }, [opportunity.data?.title])

  if (opportunity.isPending) return <div className="trade-detail-state" role="status">در حال بارگذاری فرصت تجاری…</div>
  if (opportunity.isError) {
    return (
      <div className="trade-detail-state" role="alert">
        <h1>فرصت تجاری پیدا نشد یا در دسترس نیست.</h1>
        <p>ممکن است فرصت منقضی شده یا انتشار آن متوقف شده باشد.</p>
        <AppLink href="/trade/">بازگشت به فرصت‌های تجاری</AppLink>
      </div>
    )
  }

  const item = opportunity.data
  return (
    <article className="trade-detail" dir="rtl">
      <nav aria-label="مسیر صفحه" className="trade-detail-breadcrumb">
        <AppLink href="/">خانه</AppLink><span aria-hidden="true">/</span>
        <AppLink href="/trade/">فرصت‌های تجاری</AppLink><span aria-hidden="true">/</span>
        <span aria-current="page">{item.title}</span>
      </nav>
      <header className="trade-detail-header">
        <span className="trade-detail-type"><TradeTypeIcon type={item.opportunity_type} />{item.opportunity_type_display}</span>
        <h1>{item.title}</h1>
        <p>
          <AppLink href={`/provinces/${encodeURIComponent(item.province_slug)}/`}>{item.province_name_fa}</AppLink>
          {item.city_name_fa && `، ${item.city_name_fa}`}
        </p>
      </header>
      <div className="trade-detail-layout">
        <section className="trade-detail-body" aria-labelledby="trade-detail-description">
          <h2 id="trade-detail-description">شرح فرصت</h2>
          <p>{item.description}</p>
        </section>
        <aside className="trade-detail-facts" aria-label="اطلاعات فرصت">
          <h2>اطلاعات فرصت</h2>
          <dl>
            {item.company && <div><dt>شرکت</dt><dd>{item.company.name}</dd></div>}
            {item.product_name_fa && <div><dt>محصول</dt><dd>{item.product_name_fa}</dd></div>}
            {item.industry_name_fa && <div><dt>صنعت</dt><dd>{item.industry_name_fa}</dd></div>}
            {item.target_market && <div><dt>بازار هدف</dt><dd>{item.target_market}</dd></div>}
            {item.required_volume && <div><dt>حجم موردنیاز</dt><dd>{formatNumber(Number(item.required_volume))} {item.volume_unit}</dd></div>}
            {item.min_value && item.max_value && <div><dt>محدوده ارزش</dt><dd>{formatNumber(Number(item.min_value))} تا {formatNumber(Number(item.max_value))} {item.currency}</dd></div>}
            {item.published_at && <div><dt>تاریخ انتشار</dt><dd><time dateTime={item.published_at}>{formatShortDate(item.published_at)}</time></dd></div>}
            {item.valid_until && <div><dt>اعتبار تا</dt><dd><time dateTime={item.valid_until}>{formatShortDate(item.valid_until)}</time></dd></div>}
            {item.source && <div><dt>منبع</dt><dd>{item.source_url ? <a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.source}</a> : item.source}</dd></div>}
          </dl>
          {item.service_listing_slug && (
            <AppLink className="trade-detail-action" href={`/services/listings/${encodeURIComponent(item.service_listing_slug)}`}>
              مشاهده محصول مرتبط
            </AppLink>
          )}
        </aside>
      </div>
      <AppLink className="trade-detail-back" href="/trade/">مشاهده همه فرصت‌های تجاری</AppLink>
    </article>
  )
}
