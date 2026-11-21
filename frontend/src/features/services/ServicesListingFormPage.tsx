import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { apiGet } from '@/lib/api-client'
import type { ProductListing } from './types'
import { ErrorState, ListingForm, Loading } from './shared'
import { API } from './services.utils'

export function ServicesListingFormPage() {
  const { listingId } = useParams()
  const { data: user } = useAuth()
  const listings = useQuery({
    queryKey: ['services', 'my-listings'],
    queryFn: () => apiGet<ProductListing[]>(`${API}/my/listings`),
    enabled: Boolean(user && listingId),
  })
  const personal = listings.data?.find((item) => item.id === Number(listingId))
  const companyListings = useQuery({
    queryKey: ['business', 'listings', 'edit', listingId],
    queryFn: () => apiGet<{ results: ProductListing[] }>('/v1/business/listings?page_size=50'),
    enabled: Boolean(user && listingId && listings.isSuccess && !personal),
  })
  const listing =
    personal ?? companyListings.data?.results.find((item) => item.id === Number(listingId))
  if (!user) return <div className="svc-page" dir="rtl"><ListingForm /></div>
  if (listingId && (listings.isLoading || companyListings.isLoading)) return <div className="svc-page" dir="rtl"><Loading /></div>
  if (listings.isError || companyListings.isError) return <div className="svc-page" dir="rtl"><ErrorState error={listings.error ?? companyListings.error} /></div>
  if (listingId && !listing) return <div className="svc-page" dir="rtl"><p className="svc-error">محصول پیدا نشد یا اجازه ویرایش آن را ندارید.</p></div>
  return <div className="svc-page" dir="rtl"><ListingForm listing={listing} /></div>
}
