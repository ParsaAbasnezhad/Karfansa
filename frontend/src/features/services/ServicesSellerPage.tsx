import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiGet } from '@/lib/api-client'
import type { ProductListingPage, ServiceSeller } from './types'
import { ErrorState, Loading, ProductGrid } from './shared'
import { API } from './services.utils'

export function ServicesSellerPage() {
  const { sellerId = '' } = useParams()
  const seller = useQuery({
    queryKey: ['services', 'seller', sellerId],
    queryFn: ({ signal }) => apiGet<ServiceSeller>(
      `${API}/sellers/${encodeURIComponent(sellerId)}`,
      undefined,
      signal,
    ),
    enabled: Boolean(sellerId),
  })
  const listings = useQuery({
    queryKey: ['services', 'seller-listings', sellerId],
    queryFn: ({ signal }) =>
      apiGet<ProductListingPage>(`${API}/listings/`, { seller: sellerId, page_size: 50 }, signal),
    enabled: Boolean(sellerId),
  })
  return (
    <div className="svc-page" dir="rtl">
      {seller.isPending ? <Loading /> : seller.isError ? <ErrorState error={seller.error} /> : (
        <section className="svc-seller-profile">
          <span className="svc-avatar" aria-hidden="true">{seller.data.display_name.slice(0, 1)}</span>
          <div><span className="svc-eyebrow">تولیدکننده مستقل</span><h1>{seller.data.display_name}</h1>
            <p>{seller.data.province_name}{seller.data.city_name ? `، ${seller.data.city_name}` : ''}</p>
            <p>{seller.data.bio}</p>
          </div>
        </section>
      )}
      <section className="svc-section">
        <div className="svc-section-heading"><h2>محصولات این فروشنده</h2></div>
        {listings.isPending ? <Loading /> : listings.isError ? <ErrorState error={listings.error} /> : <ProductGrid items={listings.data.results} />}
      </section>
    </div>
  )
}
