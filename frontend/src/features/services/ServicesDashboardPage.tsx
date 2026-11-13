import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { useAuth } from '@/features/auth/useAuth'
import { ApiError, apiGet, apiPost } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import type { ProductInquiry, ProductListing, SellerDashboard, ServiceSeller } from './types'
import { ErrorState, InquiryList, Loading, SellerProfileForm } from './shared'
import { API, messageFrom } from './services.utils'

export function ServicesDashboardPage() {
  const { data: user } = useAuth()
  const queryClient = useQueryClient()
  const profile = useQuery({
    queryKey: ['services', 'seller-profile'],
    queryFn: () => apiGet<ServiceSeller>(`${API}/seller/profile`),
    enabled: Boolean(user),
    retry: false,
  })
  const dashboard = useQuery({
    queryKey: ['services', 'dashboard'],
    queryFn: () => apiGet<SellerDashboard>(`${API}/dashboard`),
    enabled: Boolean(user && profile.data),
  })
  const listings = useQuery({
    queryKey: ['services', 'my-listings'],
    queryFn: () => apiGet<ProductListing[]>(`${API}/my/listings`),
    enabled: Boolean(user && profile.data),
  })
  const inquiries = useQuery({
    queryKey: ['services', 'received-inquiries'],
    queryFn: () => apiGet<ProductInquiry[]>(`${API}/inquiries/received`),
    enabled: Boolean(user && profile.data),
  })
  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiPost(`${API}/my/listings/${id}/archive`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['services'] }),
  })

  if (!user) return <div className="svc-page" dir="rtl"><section className="svc-form-card"><h1>پنل فروشنده</h1><p><AppLink href="/login">برای مدیریت محصولات وارد حساب شوید.</AppLink></p></section></div>
  if (profile.isPending) return <div className="svc-page" dir="rtl"><Loading /></div>
  if (profile.isError && profile.error instanceof ApiError && profile.error.status === 404) {
    return <div className="svc-page" dir="rtl"><SellerProfileForm /></div>
  }
  if (profile.isError) return <div className="svc-page" dir="rtl"><ErrorState error={profile.error} /></div>

  return (
    <div className="svc-page" dir="rtl">
      <div className="svc-section-heading svc-dashboard-heading"><div><span className="svc-eyebrow">پنل فروشنده</span><h1>سلام، {profile.data.display_name}</h1></div><Link className="svc-button" to="/services/listings/new">ثبت محصول جدید</Link></div>
      {dashboard.isError && <ErrorState error={dashboard.error} />}
      {dashboard.data && <div className="svc-stats">
        <div><strong>{formatNumber(dashboard.data.listings_total)}</strong><span>همه محصولات</span></div>
        <div><strong>{formatNumber(dashboard.data.listings_pending)}</strong><span>در انتظار بررسی</span></div>
        <div><strong>{formatNumber(dashboard.data.listings_approved)}</strong><span>منتشرشده</span></div>
        <div><strong>{formatNumber(dashboard.data.inquiries_new)}</strong><span>درخواست جدید</span></div>
      </div>}
      <SellerProfileForm existing={profile.data} />
      <section className="svc-section">
        <div className="svc-section-heading"><h2>محصولات من</h2></div>
        {archiveMutation.isError && <p className="svc-error" role="alert">{messageFrom(archiveMutation.error)}</p>}
        {listings.isPending ? <Loading /> : listings.isError ? <ErrorState error={listings.error} /> : (
          <div className="svc-dashboard-list">{listings.data.map((item) => (
            <article key={item.id}>
              <div><strong>{item.title}</strong><span>{item.status_display}</span></div>
              {item.rejection_reason && <p className="svc-error">{item.rejection_reason}</p>}
              <Link to={`/services/listings/${item.id}/edit`}>ویرایش</Link>
              {item.status !== 'archived' && <button type="button" onClick={() => archiveMutation.mutate(item.id)}>بایگانی</button>}
            </article>
          ))}</div>
        )}
      </section>
      <section className="svc-section">
        <div className="svc-section-heading"><h2>درخواست‌های خرید دریافتی</h2></div>
        {inquiries.isPending ? <Loading /> : inquiries.isError ? <ErrorState error={inquiries.error} /> : <InquiryList inquiries={inquiries.data} />}
      </section>
    </div>
  )
}
