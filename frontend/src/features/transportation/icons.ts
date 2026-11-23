import air from '@/assets/transportation/air.webp'
import customs from '@/assets/transportation/customs.webp'
import international from '@/assets/transportation/international.webp'
import maritime from '@/assets/transportation/maritime.webp'
import multimodal from '@/assets/transportation/multimodal.webp'
import rail from '@/assets/transportation/rail.webp'
import road from '@/assets/transportation/road.webp'
import urban from '@/assets/transportation/urban.webp'
import warehouse from '@/assets/transportation/warehouse.webp'

export const TRANSPORT_CATEGORY_ICONS = {
  road,
  sea: maritime,
  maritime,
  air,
  rail,
  multimodal,
  warehouse,
  international,
  customs,
  urban,
} as const

export type TransportCategoryCode = keyof typeof TRANSPORT_CATEGORY_ICONS

export const TRANSPORT_CATEGORY_ORDER = [
  'road',
  'sea',
  'air',
  'rail',
  'multimodal',
  'warehouse',
  'international',
  'customs',
  'urban',
] as const

export const TRANSPORT_CATEGORY_TITLES: Record<(typeof TRANSPORT_CATEGORY_ORDER)[number], string> = {
  road: 'حمل‌ونقل جاده‌ای',
  sea: 'حمل‌ونقل دریایی',
  air: 'حمل‌ونقل هوایی',
  rail: 'حمل‌ونقل ریلی',
  multimodal: 'حمل‌ونقل ترکیبی',
  warehouse: 'انبارداری و لجستیک',
  international: 'حمل‌ونقل بین‌المللی',
  customs: 'ترخیص کالا و خدمات گمرکی',
  urban: 'حمل‌ونقل شهری و توزیع',
}

export function transportCategoryIcon(code: string) {
  if (code in TRANSPORT_CATEGORY_ICONS) {
    return TRANSPORT_CATEGORY_ICONS[code as TransportCategoryCode]
  }
  return TRANSPORT_CATEGORY_ICONS.multimodal
}

export function transportCategoryTitle(code: string, fallback?: string) {
  return (
    TRANSPORT_CATEGORY_TITLES[code as (typeof TRANSPORT_CATEGORY_ORDER)[number]] ||
    fallback ||
    'حمل‌ونقل'
  )
}
