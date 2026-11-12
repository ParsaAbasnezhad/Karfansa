import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import type { ProductListing } from './types'
import { ErrorState, InquiryForm, Loading } from './shared'
import { API } from './services.utils'

export function ServicesProductDetailPage() {
  const { slug = '' } = useParams()
  const query = useQuery({
    queryKey: ['services', 'listing', slug],
    queryFn: ({ signal }) => apiGet<ProductListing>(
      `${API}/listings/${encodeURIComponent(slug)}`,
      undefined,
      signal,
    ),
    enabled: Boolean(slug),
  })
  if (query.isPending) return <div className="svc-page" dir="rtl"><Loading /></div>
  if (query.isError) return <div className="svc-page" dir="rtl"><ErrorState error={query.error} /></div>
  const item = query.data
  return (
    <div className="svc-page" dir="rtl">
      <div className="svc-detail">
        <div className="svc-detail-main">
          <div className="svc-detail-gallery">
            {item.images.length ? item.images.map((image) => (
              <img key={image.id} src={image.url} alt={image.alt_text || item.title} />
            )) : <div className="svc-image-placeholder">تصویری برای این محصول ثبت نشده است</div>}
          </div>
          <p className="svc-eyebrow">{item.category_name} · {item.province_name}{item.city_name ? `، ${item.city_name}` : ''}</p>
          <h1>{item.title}</h1>
          <p className="svc-detail-description">{item.description}</p>
          <dl className="svc-spec-list">
            <div><dt>موجودی</dt><dd>{formatNumber(Number(item.quantity))} {item.unit}</dd></div>
            <div><dt>حداقل سفارش</dt><dd>{item.minimum_order_quantity ? `${formatNumber(Number(item.minimum_order_quantity))} ${item.unit}` : 'توافقی'}</dd></div>
            <div><dt>قیمت واحد</dt><dd>{item.price === null ? 'توافقی' : `${formatNumber(Number(item.price))} ${item.currency}`}</dd></div>
            <div><dt>نوع فروش</dt><dd>{item.sale_mode_display}</dd></div>
            {item.quality && <div><dt>کیفیت</dt><dd>{item.quality}</dd></div>}
            {item.packaging && <div><dt>بسته‌بندی</dt><dd>{item.packaging}</dd></div>}
            {item.specifications.map((spec) => <div key={spec.id}><dt>{spec.name}</dt><dd>{spec.value}</dd></div>)}
          </dl>
        </div>
        <aside className="svc-detail-aside">
          <Link className="svc-seller-card" to={`/services/sellers/${item.seller.id}`}>
            <span className="svc-avatar" aria-hidden="true">{item.seller.display_name.slice(0, 1)}</span>
            <strong>{item.seller.display_name}</strong>
            <small>{item.seller.province_name}{item.seller.city_name ? `، ${item.seller.city_name}` : ''}</small>
            {item.seller.bio && <span>{item.seller.bio}</span>}
          </Link>
          <InquiryForm listing={item} />
        </aside>
      </div>
    </div>
  )
}
