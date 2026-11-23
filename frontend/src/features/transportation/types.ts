export type TransportMode = {
  code: string
  name_fa: string
  name_en: string
  company_count?: number
}

export type TransportPlace = {
  slug?: string
  name_fa: string
  id?: number
  iso2?: string
}

export type TransportCompanyCard = {
  id: string
  slug: string
  name: string
  english_name: string
  logo: string | null
  cover_image: string | null
  description: string
  province: TransportPlace | null
  city: TransportPlace | null
  transport_types: TransportMode[]
  tracking_available: boolean
  insurance_available: boolean
  customs_services: boolean
  is_verified: boolean
  fleet_capacity: string
}

export type TransportCompanyDetail = TransportCompanyCard & {
  vehicle_types: Array<{ slug: string; name_fa: string; name_en: string }>
  service_provinces: Array<{ slug: string; name_fa: string }>
  origin_countries: Array<{ name_fa: string; iso2: string }>
  destination_countries: Array<{ name_fa: string; iso2: string }>
  address: string
  phone: string
  mobile: string
  email: string
  website: string
  whatsapp: string
  telegram: string
  instagram: string
}

export type TransportCompanyPage = {
  items: TransportCompanyCard[]
  count: number
}
