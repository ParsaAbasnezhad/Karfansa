import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiGet } from '@/lib/api-client'
import type { ProductListingPage, ServiceCategory } from './types'
import { ErrorState, Loading, ProductGrid, ServiceHero } from './shared'
import { API, flattenCategories } from './services.utils'

export function ServicesLandingPage() {
  const categories = useQuery({
    queryKey: ['services', 'categories'],
    queryFn: ({ signal }) => apiGet<ServiceCategory[]>(`${API}/categories/`, undefined, signal),
  })
  const listings = useQuery({
    queryKey: ['services', 'landing-listings'],
    queryFn: ({ signal }) =>
      apiGet<ProductListingPage>(`${API}/listings/`, { page_size: 6 }, signal),
  })

  return (
    <div className="svc-page" dir="rtl">
      <ServiceHero />
      <section className="svc-section">
        <div className="svc-section-heading">
          <div><span className="svc-eyebrow">شروع جست‌وجو</span><h2>دسته‌بندی محصولات</h2></div>
          <Link to="/services/listings">همه محصولات</Link>
        </div>
        {categories.isPending ? <Loading /> : categories.isError ? <ErrorState error={categories.error} /> : (
          <div className="svc-category-grid">
            {flattenCategories(categories.data).map((category) => (
              <Link key={category.id} to={`/services/listings?category=${encodeURIComponent(category.slug)}`}>
                <span aria-hidden="true">◇</span><strong>{category.name}</strong>
                {category.description && <small>{category.description}</small>}
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="svc-section">
        <div className="svc-section-heading"><div><span className="svc-eyebrow">تازه‌ترین عرضه‌ها</span><h2>محصولات تأییدشده</h2></div></div>
        {listings.isPending ? <Loading /> : listings.isError ? <ErrorState error={listings.error} /> : (
          <ProductGrid items={listings.data.results} />
        )}
      </section>
    </div>
  )
}
