// Sample data for VITE_USE_MOCK=true. The shapes are the API contract (lib/types.ts).
import type {
  AnalysisResponse,
  Analyst,
  CompanyNewsItem,
  Counts,
  Market,
  Report,
  Slide,
  TickerItem,
  TransportCompany,
} from './types'

const TEHRAN_OFFSET = '+03:30' // Iran has no daylight saving time.
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3).toISOString()
const todayAt = (hh: string, mm: string) => {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
  return new Date(`${ymd}T${hh}:${mm}:00${TEHRAN_OFFSET}`).toISOString()
}
const IMG = {
  building: '/img/building.jpg',
  refinery: '/img/refinery.jpg',
  board: '/img/board.jpg',
  hero: '/img/hero.jpg',
}

export const ticker: TickerItem[] = [
  {
    id: 1,
    title: 'مرکز آمار: رشد اقتصادی تابستان ۱۴۰۵ به ۲٫۳ درصد رسید',
    published_at: todayAt('14', '10'),
    url: '/news/1/',
  },
  {
    id: 2,
    title: 'افزایش سرمایه یکی از بانک‌های خصوصی تصویب شد',
    published_at: todayAt('13', '45'),
    url: '/news/2/',
  },
  {
    id: 3,
    title: 'شاخص کل بورس با رشد ۰٫۳۱ درصدی در محدوده ۲٫۹ میلیون واحد ایستاد',
    published_at: todayAt('13', '20'),
    url: '/news/3/',
  },
  {
    id: 4,
    title: 'تولید فولاد خام کشور از مرز ۱۸ میلیون تن گذشت',
    published_at: todayAt('12', '45'),
    url: '/news/4/',
  },
  {
    id: 5,
    title: 'قیمت طلا و سکه در بازار امروز؛ روند صعودی ادامه دارد',
    published_at: todayAt('11', '40'),
    url: '/news/5/',
  },
]

export const slides: Slide[] = [
  {
    id: 1,
    category: 'اقتصاد کلان',
    title: 'رشد ۲٫۳ درصدی اقتصاد ایران در تابستان ۱۴۰۵؛ ادامه روند مثبت در بخش‌های غیرنفتی',
    excerpt:
      'مرکز آمار ایران اعلام کرد که تولید ناخالص داخلی در فصل تابستان سال جاری نسبت به مدت مشابه سال گذشته ۲٫۳ درصد رشد داشته است. این رشد عمدتاً ناشی از افزایش فعالیت‌های بخش‌ها...',
    read_minutes: 2,
    published_at: hoursAgo(1),
    image: IMG.hero,
    url: '/news/1/',
  },
  {
    id: 2,
    category: 'بورس',
    title: 'شاخص کل بورس با رشد ۰٫۳۱ درصدی در محدوده ۲٫۹ میلیون واحد ایستاد',
    excerpt:
      'معاملات امروز بازار سهام با تقاضای نمادهای بزرگ شروع شد و ارزش معاملات خرد نسبت به روز گذشته افزایش یافت. صنایع پتروشیمی و فلزات اساسی بیشترین اثر مثبت را بر شاخص داشتند.',
    read_minutes: 3,
    published_at: hoursAgo(2),
    image: IMG.board,
    url: '/news/3/',
  },
  {
    id: 3,
    category: 'انرژی',
    title: 'صادرات فرآورده‌های نفتی در ۶ ماهه نخست امسال افزایش یافت',
    excerpt:
      'آمارهای رسمی نشان می‌دهد حجم صادرات فرآورده‌های نفتی نسبت به مدت مشابه سال قبل رشد کرده و سهم بازارهای منطقه‌ای در سبد صادراتی بیشتر شده است.',
    read_minutes: 2,
    published_at: hoursAgo(3),
    image: IMG.refinery,
    url: '/news/6/',
  },
  {
    id: 4,
    category: 'بانک و بیمه',
    title: 'مصوبه جدید شورای پول و اعتبار برای تسهیلات تولید ابلاغ شد',
    excerpt:
      'بر اساس مصوبه تازه، سقف و شرایط پرداخت تسهیلات سرمایه در گردش به واحدهای تولیدی بازنگری شده و بانک‌ها موظف به اجرای آن شده‌اند.',
    read_minutes: 2,
    published_at: hoursAgo(4),
    image: IMG.building,
    url: '/news/7/',
  },
]

export const markets: Market[] = [
  {
    id: 'usd',
    title: 'دلار',
    short_title: 'دلار',
    subtitle: 'بازار آزاد · تومان',
    icon: 'dollar',
    value: 103520,
    change: 0.61,
    spark: [8, 9, 8.5, 10, 9.5, 11, 10.5, 12, 11.5, 13],
  },
  {
    id: 'gold18',
    title: 'طلا ۱۸ عیار',
    short_title: 'طلا ۱۸ عیار',
    subtitle: 'هر گرم · تومان',
    icon: 'coins',
    value: 10870000,
    change: 0.52,
    spark: [6, 7, 7, 8.5, 8, 9.5, 10, 10.5, 11.5, 12.5],
  },
  {
    id: 'tedpix',
    title: 'شاخص کل بورس',
    short_title: 'شاخص کل',
    subtitle: 'امتیاز',
    icon: 'bars',
    value: 2912450,
    change: 0.31,
    spark: [10, 8, 9, 7, 8.5, 7.5, 9, 10.5, 10, 11.5],
  },
  {
    id: 'brent',
    title: 'نفت برنت',
    short_title: 'برنت',
    subtitle: 'دلار در هر بشکه',
    icon: 'drop',
    value: 73.42,
    change: 0.87,
    spark: [6, 7.5, 7, 8, 9, 8.5, 10, 11, 10.5, 12],
  },
]

// `featured` (1..6) marks the companies shown under the "all" tab, in that order.
export type MockTransportCompany = TransportCompany & { featured?: number }
const company = (
  id: number,
  type: TransportCompany['type'],
  name: string,
  description: string,
  city: string,
  fleet_count: number,
  fleet_unit: string,
  route_count: number,
  route_unit: string,
  featured?: number,
): MockTransportCompany => ({
  id,
  type,
  name,
  description,
  city,
  fleet_count,
  fleet_unit,
  route_count,
  route_unit,
  featured,
  url: `/transport/${id}/`,
})

export const transportCompanies: MockTransportCompany[] = [
  company(
    1,
    'road',
    'پارس‌ترابر',
    'حمل کالای فله و کانتینری در سراسر کشور',
    'تهران',
    1200,
    'دستگاه',
    85,
    'مسیر',
    1,
  ),
  company(
    2,
    'sea',
    'کشتیرانی دریای جنوب',
    'خدمات حمل دریایی و بندری در خلیج فارس',
    'بندرعباس',
    45,
    'فروند',
    24,
    'بندر',
    2,
  ),
  company(
    3,
    'rail',
    'ایران‌ریل',
    'حمل ریلی بار و ترانزیت شمال–جنوب',
    'تهران',
    850,
    'واگن',
    18,
    'خط',
    3,
  ),
  company(
    4,
    'trans',
    'ترانزیت خزر',
    'ترانزیت کالا به آسیای میانه و قفقاز',
    'رشت',
    600,
    'دستگاه',
    36,
    'مسیر',
    4,
  ),
  company(
    5,
    'log',
    'لجستیک نوین سپهر',
    'انبارداری، توزیع و مدیریت زنجیره تامین',
    'اصفهان',
    20,
    'انبار',
    140,
    'مشتری',
    5,
  ),
  company(
    6,
    'air',
    'آسمان‌بار',
    'حمل هوایی بار و محموله‌های فوری',
    'تهران',
    18,
    'هواپیما',
    32,
    'مقصد',
    6,
  ),
  company(
    7,
    'road',
    'باربری آریا',
    'حمل بار سنگین و پروژه‌ای بین شهری',
    'مشهد',
    720,
    'دستگاه',
    62,
    'مسیر',
  ),
  company(
    8,
    'sea',
    'خطوط دریایی خزر',
    'حمل کانتینر و فله در دریای مازندران',
    'نوشهر',
    28,
    'فروند',
    9,
    'بندر',
  ),
  company(
    9,
    'rail',
    'راه‌آهن باری پارسیان',
    'حمل کانتینری ریلی بین مراکز صنعتی',
    'اراک',
    420,
    'واگن',
    11,
    'خط',
  ),
  company(
    10,
    'air',
    'پرواز بار ایرانیان',
    'شبکه پروازهای باری داخلی و منطقه‌ای',
    'شیراز',
    9,
    'هواپیما',
    19,
    'مقصد',
  ),
  company(
    11,
    'log',
    'زنجیره تامین آتی',
    'مدیریت انبار و توزیع کالاهای مصرفی',
    'کرج',
    14,
    'انبار',
    95,
    'مشتری',
  ),
  company(
    12,
    'trans',
    'کریدور شرق',
    'ترانزیت جاده‌ای به شرق و آسیای مرکزی',
    'سرخس',
    480,
    'دستگاه',
    28,
    'مسیر',
  ),
]
export const transportCounts: Counts = { all: 124, road: 48, sea: 22, rail: 14, air: 9, log: 31 }

const news = (
  id: number,
  category: CompanyNewsItem['category'],
  company_name: string,
  title: string,
  image: string,
  hours: number,
): CompanyNewsItem => ({
  id,
  category,
  company_name,
  title,
  image,
  published_at: hoursAgo(hours),
  url: `/companies/news/${id}/`,
})

// Listed in the order shown under the "all" tab.
export const companyNews: CompanyNewsItem[] = [
  news(
    1,
    'sup',
    'تامین سرمایه نوین',
    'قرارداد تامین مواد اولیه خطوط تولید با شرکای داخلی امضا شد',
    IMG.building,
    7,
  ),
  news(2, 'bor', 'گروه مالی پارسیان', 'افزایش سرمایه یکی از بانک‌های خصوصی تصویب شد', IMG.board, 2),
  news(
    3,
    'pro',
    'پتروشیمی خلیج فارس',
    'بهره‌برداری از فاز جدید پتروشیمی در خلیج فارس',
    IMG.refinery,
    4,
  ),
  news(
    4,
    'sup',
    'تامین مواد اولیه ایران',
    'رشد ۱۵ درصدی سود خالص شرکت‌های بورسی در ۶ ماهه نخست',
    IMG.building,
    6,
  ),
  news(
    5,
    'exp',
    'صنایع فولاد البرز',
    'صادرات محصولات فولادی شرکت‌های عضو به بازارهای منطقه افزایش یافت',
    IMG.refinery,
    8,
  ),
  news(
    6,
    'pro',
    'گروه صنعتی ایران‌کیمیا',
    'خط تولید جدید با ظرفیت ۲۰۰ هزار تن در سال راه‌اندازی شد',
    IMG.building,
    9,
  ),
  news(
    7,
    'bor',
    'هلدینگ سرمایه‌گذاری',
    'مجمع عمومی سالانه تقسیم سود نقدی را تصویب کرد',
    IMG.board,
    10,
  ),
  news(
    8,
    'srv',
    'بازرگانی پارس‌لجستیک',
    'توسعه ناوگان حمل‌ونقل و انبارداری در مناطق ویژه اقتصادی',
    IMG.building,
    12,
  ),
]
export const companyNewsCounts: Counts = { all: 24, sup: 7, pro: 6, exp: 4, bor: 5, srv: 2 }

interface MockHeadlinesResponse {
  featured: {
    id: number
    category: string
    title: string
    excerpt: string
    image: string
    published_at: string
    is_important: boolean
    url: string
  }
  minis: { id: number; category: string; title: string; image: string; url: string }[]
  latest: { id: number; category: string; title: string; published_at: string; url: string }[]
  popular: { id: number; title: string; url: string }[]
}

export const headlines: MockHeadlinesResponse = {
  featured: {
    id: 20,
    category: 'اقتصاد کلان',
    title: 'بانک مرکزی: نرخ تورم نقطه‌ای در مهرماه کاهش یافت',
    excerpt:
      'بر پایه گزارش تازه بانک مرکزی، روند کاهشی تورم ماهانه ادامه یافته و کارشناسان آن را نشانه ثبات نسبی در بازار کالاهای اساسی می‌دانند.',
    image: IMG.board,
    published_at: todayAt('14', '30'),
    is_important: true,
    url: '/news/20/',
  },
  minis: [
    {
      id: 21,
      category: 'مناطق ویژه',
      title: 'جذب سرمایه‌گذاری جدید در مناطق آزاد تجاری تسریع می‌شود',
      image: IMG.building,
      url: '/news/21/',
    },
    {
      id: 22,
      category: 'مالیات',
      title: 'جزئیات بخشودگی جرایم مالیاتی برای فعالان اقتصادی اعلام شد',
      image: IMG.refinery,
      url: '/news/22/',
    },
  ],
  latest: [
    {
      id: 3,
      category: 'بورس',
      title: 'شاخص کل بورس با رشد ۰٫۳۱ درصدی در محدوده ۲٫۹ میلیون واحد ایستاد',
      published_at: todayAt('14', '20'),
      url: '/news/3/',
    },
    {
      id: 6,
      category: 'انرژی',
      title: 'صادرات فرآورده‌های نفتی در ۶ ماهه نخست امسال افزایش یافت',
      published_at: todayAt('13', '55'),
      url: '/news/6/',
    },
    {
      id: 7,
      category: 'بانک و بیمه',
      title: 'مصوبه جدید شورای پول و اعتبار برای تسهیلات تولید ابلاغ شد',
      published_at: todayAt('13', '30'),
      url: '/news/7/',
    },
    {
      id: 4,
      category: 'صنعت',
      title: 'تولید فولاد خام کشور از مرز ۱۸ میلیون تن گذشت',
      published_at: todayAt('12', '45'),
      url: '/news/4/',
    },
    {
      id: 23,
      category: 'تجارت',
      title: 'ارزش صادرات غیرنفتی در پنج ماه نخست سال رشد کرد',
      published_at: todayAt('12', '10'),
      url: '/news/23/',
    },
    {
      id: 5,
      category: 'ارز و طلا',
      title: 'قیمت طلا و سکه در بازار امروز؛ روند صعودی ادامه دارد',
      published_at: todayAt('11', '40'),
      url: '/news/5/',
    },
  ],
  popular: [
    { id: 1, title: 'رشد ۲٫۳ درصدی اقتصاد ایران در تابستان ۱۴۰۵', url: '/news/1/' },
    { id: 2, title: 'افزایش سرمایه یکی از بانک‌های خصوصی تصویب شد', url: '/news/2/' },
    { id: 8, title: 'بهره‌برداری از فاز جدید پتروشیمی در خلیج فارس', url: '/news/8/' },
    { id: 9, title: 'رشد ۱۵ درصدی سود خالص شرکت‌های بورسی', url: '/news/9/' },
    { id: 10, title: 'صادرات محصولات فولادی به بازارهای منطقه افزایش یافت', url: '/news/10/' },
    { id: 22, title: 'جزئیات بخشودگی جرایم مالیاتی فعالان اقتصادی اعلام شد', url: '/news/22/' },
  ],
}

export const analysis: AnalysisResponse = {
  hero: {
    id: 1,
    tag: 'ویژه',
    title: 'چشم‌انداز اقتصاد ایران در نیمه دوم ۱۴۰۵؛ فرصت‌ها و تهدیدها',
    excerpt:
      'در این گزارش جامع، رشد، تورم، نرخ ارز، بازار سرمایه و سیاست‌های پولی با نگاه به سناریوهای محتمل پیش رو بررسی شده است.',
    author: 'دکتر رضا کریمی',
    read_minutes: 10,
    image: IMG.hero,
    download_url: '/media/reports/outlook-1405.pdf',
    url: '/analysis/1/',
  },
  articles: [
    {
      id: 11,
      kind: 'analysis',
      category: 'بازار سرمایه',
      title: 'آیا رشد بورس در ماه‌های آینده پایدار می‌ماند؟',
      excerpt: 'بررسی عوامل بنیادی و روانی مؤثر بر روند شاخص کل و ریسک‌های پیش‌رو.',
      author: 'دکتر رضا کریمی',
      read_minutes: 7,
      published_at: hoursAgo(26),
      url: '/analysis/11/',
    },
    {
      id: 12,
      kind: 'report',
      category: 'صنایع و معادن',
      title: 'زنجیره ارزش فولاد؛ فرصت‌های سرمایه‌گذاری تازه',
      excerpt: 'تحلیل حاشیه سود و ظرفیت‌های صادراتی شرکت‌های بزرگ فولادی.',
      author: 'مریم احمدی',
      read_minutes: 6,
      published_at: hoursAgo(50),
      url: '/analysis/12/',
    },
    {
      id: 13,
      kind: 'analysis',
      category: 'ارز و طلا',
      title: 'سناریوهای بازار ارز تا پایان سال',
      excerpt: 'عوامل مؤثر بر قیمت‌ها و پیش‌بینی روند در سه سناریوی خوش‌بینانه تا بدبینانه.',
      author: 'حسین نوری',
      read_minutes: 5,
      published_at: hoursAgo(74),
      url: '/analysis/13/',
    },
  ],
}

export const reports: Report[] = [
  { id: 1, title: 'گزارش فصلی بازار سرمایه؛ تابستان ۱۴۰۵', pages: 24, url: '/media/reports/1.pdf' },
  { id: 2, title: 'چشم‌انداز صنعت پتروشیمی در سال آینده', pages: 18, url: '/media/reports/2.pdf' },
  { id: 3, title: 'بررسی عملکرد بانک‌ها در شش‌ماهه نخست', pages: 30, url: '/media/reports/3.pdf' },
  {
    id: 4,
    title: 'بازار طلا و ارز؛ سناریوهای سه‌ماهه پایانی',
    pages: 12,
    url: '/media/reports/4.pdf',
  },
]

export const analysts: Analyst[] = [
  { id: 1, name: 'دکتر رضا کریمی', role: 'تحلیلگر بازار سرمایه', url: '/analysts/1/' },
  { id: 2, name: 'مریم احمدی', role: 'کارشناس صنایع', url: '/analysts/2/' },
  { id: 3, name: 'حسین نوری', role: 'اقتصاددان', url: '/analysts/3/' },
]
