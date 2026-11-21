export type ServiceCategory = {
  id: number
  name: string
  slug: string
  description: string
  parent_id: number | null
  children: ServiceCategory[]
}

export type ServiceImage = {
  id: number
  url: string
  alt_text: string
  sort_order: number
}

export type ServiceSpecification = {
  id: number
  name: string
  value: string
}

export type ServiceSeller = {
  id: number
  display_name: string
  bio: string
  province_id: number | null
  city_id: number | null
  province_name: string | null
  city_name: string | null
  is_public: boolean
}

export type ProductListing = {
  id: number
  title: string
  slug: string
  description: string
  category_id: number
  category_name: string
  category_slug: string
  seller: ServiceSeller
  listing_kind?: 'product' | 'service'
  organization_id?: string | null
  organization_name?: string | null
  province_id: number
  province_name: string
  province_slug: string
  city_id: number | null
  city_name: string | null
  sale_mode: 'domestic' | 'export' | 'both'
  sale_mode_display: string
  quantity: string
  unit: string
  price: string | null
  currency: string
  is_price_negotiable: boolean
  minimum_order_quantity: string | null
  quality: string
  packaging: string
  is_export_available: boolean
  is_domestic_available: boolean
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived'
  status_display: string
  is_active: boolean
  rejection_reason: string
  images: ServiceImage[]
  specifications: ServiceSpecification[]
  created_at: string
  updated_at: string
  published_at: string | null
}

export type ProductListingPage = {
  results: ProductListing[]
  count: number
  page: number
  page_size: number
  total_pages: number
}

export type ProductInquiry = {
  id: number
  listing_id: number
  listing_title: string
  listing_slug: string
  buyer_name: string
  message: string
  quantity: string | null
  status: 'new' | 'read' | 'replied' | 'closed'
  status_display: string
  created_at: string
  updated_at: string
}

export type SellerDashboard = {
  profile: ServiceSeller
  listings_total: number
  listings_pending: number
  listings_approved: number
  inquiries_new: number
}
