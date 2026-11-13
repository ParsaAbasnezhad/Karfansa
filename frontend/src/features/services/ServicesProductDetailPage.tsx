import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import type { ProductListing, ServiceImage } from './types'
import { ErrorState, InquiryForm, Loading } from './shared'
import { API } from './services.utils'

function ProductGallery({ images, title }: { images: ServiceImage[]; title: string }) {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const index = images.length ? Math.min(active, images.length - 1) : 0
  const current = images[index]

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
      if (images.length < 2) return
      if (event.key === 'ArrowLeft') setActive((value) => (value + 1) % images.length)
      if (event.key === 'ArrowRight') setActive((value) => (value - 1 + images.length) % images.length)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, images.length])

  if (!current) {
    return <div className="svc-image-placeholder">تصویری برای این محصول ثبت نشده است</div>
  }

  const show = (next: number) => setActive((next + images.length) % images.length)

  return (
    <div className="svc-detail-gallery">
      <button
        type="button"
        className="svc-gallery-stage"
        onClick={() => setOpen(true)}
        aria-label={`بزرگ‌نمایی ${current.alt_text || title}`}
      >
        <img src={current.url} alt={current.alt_text || title} />
        <span>برای دیدن تصویر کلیک کنید</span>
      </button>
      {images.length > 1 && (
        <div className="svc-gallery-thumbs">
          {images.map((image, imageIndex) => (
            <button
              key={image.id}
              type="button"
              className={imageIndex === index ? 'is-active' : undefined}
              aria-label={`نمایش تصویر ${imageIndex + 1}`}
              aria-pressed={imageIndex === index}
              onClick={() => setActive(imageIndex)}
            >
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div
          className="svc-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="نمایش تصویر محصول"
          onClick={() => setOpen(false)}
        >
          <div className="svc-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <div className="svc-lightbox-bar">
              <span>
                {formatNumber(index + 1)} از {formatNumber(images.length)}
              </span>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)}>
                بستن
              </button>
            </div>
            <img src={current.url} alt={current.alt_text || title} />
            {images.length > 1 && (
              <div className="svc-lightbox-nav">
                <button type="button" onClick={() => show(index - 1)}>
                  تصویر قبلی
                </button>
                <button type="button" onClick={() => show(index + 1)}>
                  تصویر بعدی
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

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
          <ProductGallery images={item.images} title={item.title} />
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
