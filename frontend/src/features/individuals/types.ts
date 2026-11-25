export type IndividualCard = {
  id: number
  display_name: string
  professional_title: string
  bio: string
  profile_image: string | null
  cover_image: string | null
  province_id: number | null
  city_id: number | null
  province_name: string | null
  city_name: string | null
  province_slug: string | null
  is_public: boolean
  is_verified: boolean
  listings_count: number
}

export type IndividualPage = {
  results: IndividualCard[]
  count: number
  page: number
  page_size: number
  total_pages: number
}
