// Fixed site content: menus, footer links and contact details.
// Move these to Django (settings or a model) if editors need to change them.

export const SITE = {
  name: 'کارفنسا',
  latin: 'KARFANSA',
  tagline: 'مرجع خبری و تحلیلی اقتصاد ایران',
  about:
    'کارفنسا، مرجع خبری و تحلیلی اقتصاد ایران؛ پوشش لحظه‌ای اخبار بازارها، شرکت‌ها و صنایع و ارائه گزارش‌های تخصصی کارشناسان اقتصادی.',
  address: 'تهران، خیابان ولیعصر، ساختمان کارفنسا',
  phone: '۰۲۱-۱۲۳۴۵۶۷۸',
  email: 'info@karfansa.ir',
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

export const NAV: NavItem[] = [
  { href: '/', label: 'صفحه اصلی', icon: 'home' },
  { href: '/news/', label: 'اخبار اقتصادی', icon: 'news' },
  { href: '/companies/', label: 'شرکت‌ها', icon: 'building' },
  { href: '/markets/', label: 'بازارها', icon: 'trend', live: true },
  { href: '/bourse/', label: 'بورس', icon: 'bars' },
  { href: '/industries/', label: 'مناطق و صنایع', icon: 'factory' },
  { href: '/analysis/', label: 'تحلیل و گزارش', icon: 'file' },
  { href: '/tech/', label: 'فناوری و نوآوری', icon: 'bolt' },
]

export const TOP_LINKS: LinkItem[] = [
  { href: '/about/', label: 'درباره ما' },
  { href: '/contact/', label: 'تماس با ما' },
  { href: '/submit-news/', label: 'ارسال خبر' },
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
  { href: '/register-company/', label: 'ثبت شرکت' },
  { href: '/archive/', label: 'آرشیو اخبار' },
]

export const FOOTER_SECTIONS: LinkItem[] = [
  { href: '/news/', label: 'اخبار اقتصادی' },
  { href: '/companies/', label: 'شرکت‌ها' },
  { href: '/markets/', label: 'بازارها' },
  { href: '/bourse/', label: 'بورس' },
  { href: '/industries/', label: 'مناطق و صنایع' },
  { href: '/analysis/', label: 'تحلیل و گزارش' },
  { href: '/transport/', label: 'حمل و نقل' },
  { href: '/tech/', label: 'فناوری و نوآوری' },
]
export const FOOTER_QUICK: LinkItem[] = [
  { href: '/', label: 'صفحه اصلی' },
  { href: '/archive/', label: 'آرشیو اخبار' },
  { href: '/register-company/', label: 'ثبت شرکت' },
  { href: '/login/', label: 'ورود / ثبت‌نام' },
  { href: '/submit-news/', label: 'ارسال خبر' },
  { href: '/ads/', label: 'تبلیغات در کارفنسا' },
]
export const FOOTER_ABOUT: LinkItem[] = [
  { href: '/about/', label: 'درباره ما' },
  { href: '/contact/', label: 'تماس با ما' },
  { href: '/careers/', label: 'همکاری با ما' },
  { href: '/terms/', label: 'قوانین استفاده' },
  { href: '/privacy/', label: 'حریم خصوصی' },
  { href: '/faq/', label: 'سوالات متداول' },
]

export const URLS = {
  login: '/login/',
  allNews: '/news/',
  markets: '/markets/',
  transportAll: '/transport/',
  registerTransport: '/transport/register/',
  companyNewsAll: '/companies/news/',
  archive: '/archive/',
  analysisAll: '/analysis/',
  reportsAll: '/analysis/reports/',
} as const
