export type IndustryRef = {
  slug: string
  name_fa: string
  name_en?: string
}

export type PlaceRef = {
  id: number
  slug: string
  name_fa: string
}

export type CompanyCard = {
  id: string
  slug: string
  name: string
  english_name: string
  logo: string | null
  organization_type: string
  organization_type_display: string
  industry: IndustryRef | null
  province: PlaceRef | null
  city: PlaceRef | null
  is_verified: boolean
  description: string
}

export type CompanyDetail = CompanyCard & {
  cover_image: string | null
  established_at: string | null
  address: string
  website: string
  whatsapp: string
  telegram: string
  linkedin: string
  instagram: string
}

export type OrganizationPage = {
  items: CompanyCard[]
  count: number
}
