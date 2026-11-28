// Fixed site content: menus, footer links and contact details.
// Move these to Django (settings or a model) if editors need to change them.

export const SITE = {
  name: 'کارفنسا',
  latin: 'KARFANSA',
  tagline: 'بازار و فرصت‌های تجاری ایران',
  about:
    'کارفنسا ابزارهایی برای جست‌وجوی محصولات، پیگیری فرصت‌های تجاری و دسترسی به اطلاعات اقتصادی در اختیار فعالان کسب‌وکار قرار می‌دهد.',
  address: '',
  phone: '',
  email: '',
  hours: '',
} as const

export interface NavItem {
  href: string
  label: string
  icon: string
  live?: boolean
}
export interface LinkItem {
  href: string
  label: string
}

export const NEWS_SITE_URL = 'https://karfansa.news.ir'

export const NAV: NavItem[] = [
  { href: '/', label: 'صفحه اصلی', icon: 'home' },
  { href: NEWS_SITE_URL, label: 'اخبار', icon: 'news' },
  { href: '/companies/', label: 'شرکت‌ها', icon: 'building' },
  { href: '/transportation/companies/', label: 'حمل‌ونقل', icon: 'truck' },
  { href: '/individuals/', label: 'فعالان فردی', icon: 'factory' },
  { href: '/provinces/', label: 'استان‌ها', icon: 'pin' },
  { href: '/industries/', label: 'مناطق و صنایع', icon: 'factory' },
  { href: '/trade/', label: 'فرصت‌های تجاری', icon: 'building' },
  { href: '/services/', label: 'بازار محصولات', icon: 'factory' },
]

export const TOP_LINKS: LinkItem[] = [
  { href: '/about/', label: 'درباره ما' },
  { href: '/contact/', label: 'تماس با ما' },
  { href: '/ads/', label: 'تبلیغات' },
]

export const SOCIAL = [
  { href: 'https://t.me/karfansa', label: 'تلگرام', icon: 'send' },
  { href: 'https://instagram.com/karfansa', label: 'اینستاگرام', icon: 'instagram' },
  { href: 'https://linkedin.com/company/karfansa', label: 'لینکدین', icon: 'linkedin' },
  { href: 'https://wa.me/', label: 'واتساپ', icon: 'whatsapp' },
  { href: 'https://x.com/karfansa', label: 'ایکس', icon: 'x' },
] as const

export const TRENDING: LinkItem[] = [
  { href: '/search?q=بورس', label: 'بورس' },
  { href: '/search?q=دلار', label: 'دلار' },
  { href: '/search?q=طلا', label: 'طلا و سکه' },
  { href: '/search?q=تورم', label: 'تورم' },
  { href: '/search?q=پتروشیمی', label: 'پتروشیمی' },
  { href: '/search?q=مالیات', label: 'مالیات' },
  { href: '/search?q=حمل‌ونقل', label: 'حمل‌ونقل' },
]

export const DRAWER_LINKS: LinkItem[] = [
  ...TOP_LINKS,
  { href: '/join/', label: 'ثبت کسب‌وکار' },
  { href: '/business/', label: 'داشبورد کسب‌وکار' },
]

export const URLS = {
  login: '/login/',
  transportAll: '/transportation/companies',
  registerTransport: '/join',
  analysisAll: '/analysis',
  reportsAll: '/analysis',
} as const
