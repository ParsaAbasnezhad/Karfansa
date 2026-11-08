export type TradeOpportunityType =
  'export' | 'import' | 'raw-materials' | 'bulk-buy' | 'bulk-sell' | 'partnership' | 'investment'

export type TradeOpportunity = {
  id: number
  title: string
  slug: string
  province_slug: string
  province_name_fa: string
  city_name_fa: string | null
  product_slug: string | null
  product_name_fa: string | null
  industry_slug: string | null
  industry_name_fa: string | null
  opportunity_type: TradeOpportunityType
  opportunity_type_display: string
  description: string
  target_market: string
  required_volume: string | null
  volume_unit: string
  min_value: string | null
  max_value: string | null
  currency: string
  company: { id: string; slug: string; name: string } | null
  source: string
  source_url: string
  published_at: string | null
  valid_until: string | null
  review_status: 'pending' | 'approved' | 'rejected'
  review_status_display: string
  is_published: boolean
  relevance_score: number
  last_reviewed_at: string | null
  created_at: string
}

export type TradeOpportunityPage = {
  results: TradeOpportunity[]
  count: number
  page: number
  page_size: number
  total_pages: number
}

export type TradeOpportunitySearchResult = TradeOpportunity & {
  match_score: number
  has_verified_contact: boolean
}

export type TradeOpportunitySearchPage = Omit<TradeOpportunityPage, 'results'> & {
  results: TradeOpportunitySearchResult[]
  applied_filters: Record<string, string>
  interpreted: {
    product: string
    province: string
    city: string
    category: string
    opportunity_type: string
    quantity: string | null
    quantity_unit: string
  }
}

export type TradeOptions = {
  provinces: Array<{ id: number; slug: string; name_fa: string }>
  products: Array<{
    id: number
    slug: string
    name_fa: string
    name_en: string
    industry_slugs: string[]
  }>
  industries: Array<{
    id: number
    slug: string
    name_fa: string
    name_en: string
    category: string
    category_display: string
  }>
  companies: Array<{ id: string; slug: string; name: string }>
  opportunity_types: Array<{ value: TradeOpportunityType; label: string }>
}

export type TradeOpportunitySubmission = {
  title: string
  province_id: number
  city_id?: number | null
  product_id?: number | null
  industry_id?: number | null
  opportunity_type: TradeOpportunityType
  description: string
  target_market: string
  required_volume: string | null
  volume_unit: string
  min_value: string | null
  max_value: string | null
  currency: string
  company_id: string | null
  source: string
  source_url: string
  valid_until: string | null
}
