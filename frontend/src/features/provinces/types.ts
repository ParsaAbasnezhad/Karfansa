export type ProvinceSummary = {
  id: number
  slug: string
  name_fa: string
  name_en: string
  is_published: boolean
}

export type ProvinceCity = {
  id: number
  province_id: number
  slug: string
  name_fa: string
  name_en: string
  population: number | null
  description: string
  is_county_center: boolean
  latitude: string | null
  longitude: string | null
}

export type ProvinceIndustry = {
  id: number
  province_id: number
  province_slug: string
  province_name_fa: string
  industry_id: number
  industry_slug: string
  industry_name_fa: string
  industry_name_en: string
  category: string
  category_display: string
  industry_description: string
  image: string | null
  description: string
  activity_level: string
  activity_level_display: string
  production_capacity: string | null
  production_capacity_unit: string
  competitive_advantage: string
  source: string
  source_url: string
  updated_year: number | null
  active_cities: ProvinceCity[]
  products: Array<{
    id: number
    slug: string
    name_fa: string
    name_en: string
    description: string
  }>
  companies: Array<{ slug: string; name: string }>
}

export type ProvinceDetail = ProvinceSummary & {
  short_description: string
  description: string
  economic_description: string
  area_sq_km: string | null
  population: number | null
  latitude: string | null
  longitude: string | null
  featured_image: string | null
  map_image: string | null
  created_at: string
  updated_at: string
  capital: ProvinceCity | null
  cities: ProvinceCity[]
  industries: ProvinceIndustry[]
}
