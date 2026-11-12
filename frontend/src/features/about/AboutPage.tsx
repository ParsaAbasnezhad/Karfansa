import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Icon } from '@/features/home/icons'
import { apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import './about.css'

const TradeGlobe = lazy(() =>
  import('./TradeGlobe').then((module) => ({ default: module.TradeGlobe })),
)

type CountResponse = { count: number }
type AboutPageContent = {
  hero_title: string
  hero_intro: string
  story_title: string
  story_body: string
  mission_title: string
  mission_body: string
  vision_title: string
  vision_body: string
}
type StatItem = { label: string; query: UseQueryResult<CountResponse> }

function AnimatedCount({ value }: { value: number }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animationFrame = window.requestAnimationFrame(() => setShown(value))
      return () => window.cancelAnimationFrame(animationFrame)
    }
    const start = performance.now()
    const duration = 650
    let animationFrame = 0
    const animate = (now: number) => {
      const progress = Math.max(0, Math.min((now - start) / duration, 1))
      setShown(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) animationFrame = window.requestAnimationFrame(animate)
    }
    animationFrame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [value])

  return <span>{formatNumber(shown)}</span>
}

function AboutStats() {
  const opportunities = useQuery({
    queryKey: ['about', 'opportunity-count'],
    queryFn: ({ signal }) =>
      apiGet<CountResponse>('/v1/trade/opportunities/', { page_size: 1 }, signal),
  })
  const products = useQuery({
    queryKey: ['about', 'product-count'],
    queryFn: ({ signal }) =>
      apiGet<CountResponse>('/v1/services/listings/', { page_size: 1 }, signal),
  })
  const news = useQuery({
    queryKey: ['about', 'news-count'],
    queryFn: ({ signal }) => apiGet<CountResponse>('/v1/news/', { page_size: 1 }, signal),
  })

  const stats: StatItem[] = [
    { label: 'فرصت‌های منتشرشده', query: opportunities },
    { label: 'محصولات تأییدشده', query: products },
    { label: 'خبرهای در دسترس', query: news },
  ]

  return (
    <section className="about-stats" aria-label="آمار زنده کارفنسا">
      {stats.map(({ label, query }) => (
        <div className="about-stat" key={label}>
          <strong
            aria-label={query.isSuccess ? formatNumber(query.data.count) : 'آمار در دسترس نیست'}
          >
            {query.isSuccess ? <AnimatedCount value={query.data.count} /> : '—'}
          </strong>
          <span>{label}</span>
        </div>
      ))}
      <p className="about-stats-note">آمار از داده‌های عمومی سامانه دریافت می‌شود.</p>
    </section>
  )
}

const services = [
  {
    icon: 'building',
    title: 'بازار محصولات',
    text: 'جست‌وجو و معرفی محصولات تأییدشده، همراه با اطلاعات عرضه و امکان ارسال درخواست خرید.',
    href: '/services/',
  },
  {
    icon: 'route',
    title: 'فرصت‌های تجاری',
    text: 'مشاهدهٔ فرصت‌های منتشرشده و ثبت فرصت برای بررسی مدیران.',
    href: '/trade/',
  },
  {
    icon: 'pin',
    title: 'استان‌ها و صنایع',
    text: 'مرور اطلاعات اقتصادی و ظرفیت‌های ثبت‌شده برای استان‌ها و صنایع.',
    href: '/provinces/',
  },
  {
    icon: 'news',
    title: 'اخبار و بازارها',
    text: 'دسترسی به خبرهای اقتصادی و داده‌های بازارهای در دسترس.',
    href: '/news/',
  },
]

const ecosystem = [
  'تولیدکنندگان',
  'تأمین‌کنندگان',
  'عمده‌فروشان',
  'بازرگانان',
  'صادرکنندگان',
  'واردکنندگان',
  'خریداران',
  'شرکت‌های حمل‌ونقل',
]

export function AboutPage() {
  const content = useQuery({
    queryKey: ['about', 'content'],
    queryFn: ({ signal }) => apiGet<AboutPageContent>('/v1/home/about/', undefined, signal),
  })

  useEffect(() => {
    document.title = 'درباره کارفنسا | زیرساخت ارتباطات تجاری'
    const description = document.querySelector('meta[name="description"]')
    if (description) {
      description.setAttribute(
        'content',
        'با مأموریت و خدمات فعال کارفنسا آشنا شوید؛ بازاری برای محصولات، فرصت‌های تجاری و اطلاعات اقتصادی.',
      )
    }
  }, [])

  return (
    <div className="about-page" dir="rtl">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="about-kicker">
            <i /> شبکهٔ اطلاعات و فرصت‌های تجاری
          </span>
          <h1>{content.data?.hero_title ?? 'درباره کارفنسا'}</h1>
          {content.data && <p>{content.data.hero_intro}</p>}
          <div className="about-hero-actions">
            <Link className="about-button about-button-primary" to="/services/">
              آشنایی با خدمات <Icon name="arrow-l" />
            </Link>
            <Link className="about-button about-button-ghost" to="/trade/">
              شروع همکاری <Icon name="route" />
            </Link>
          </div>
          <div className="about-hero-caption">
            <span className="about-caption-dot" />
            اطلاعات و فرصت‌ها پس از ثبت و بررسی در دسترس قرار می‌گیرند.
          </div>
        </div>
        <div className="about-globe-wrap">
          <div className="about-globe-halo" />
          <div className="about-globe-fallback" aria-hidden="true">
            <span className="about-fallback-orbit orbit-one" />
            <span className="about-fallback-orbit orbit-two" />
            <span className="about-fallback-core">K</span>
          </div>
          <Suspense fallback={null}>
            <LazyGlobe />
          </Suspense>
          <div className="about-globe-label">
            <span className="about-caption-dot" />
            ارتباطات تجاری، فراتر از مرزها
          </div>
        </div>
      </section>

      <AboutStats />

      <section className="about-story">
        <div className="about-story-index">
          <span>01 / نگاه ما</span>
          <i />
          <span>اطلاعات ← ارتباط ← فرصت</span>
        </div>
        <div className="about-story-copy">
          <span className="about-eyebrow">کارفنسا چه می‌کند؟</span>
          {content.isSuccess ? (
            <>
              <h2>{content.data.story_title}</h2>
              <p className="about-content-text">{content.data.story_body}</p>
            </>
          ) : (
            <p role={content.isError ? 'alert' : 'status'}>
              {content.isError
                ? 'متن معرفی در حال حاضر در دسترس نیست.'
                : 'در حال دریافت متن معرفی…'}
            </p>
          )}
        </div>
        <div className="about-story-art" aria-hidden="true">
          <div className="about-story-grid" />
          <div className="about-story-node node-a">
            <Icon name="news" />
            <span>اطلاعات</span>
          </div>
          <div className="about-story-node node-b">
            <Icon name="route" />
            <span>ارتباط</span>
          </div>
          <div className="about-story-node node-c">
            <Icon name="trend" />
            <span>فرصت</span>
          </div>
          <div className="about-story-line" />
          <div className="about-story-center">K</div>
        </div>
      </section>

      <section className="about-purpose">
        <div className="about-section-heading">
          <span className="about-eyebrow">جهت حرکت</span>
          <h2>از یک نقطهٔ شروع، تا نگاهی بلندمدت</h2>
          <p>مأموریت ما در ابزارهای امروز دیده می‌شود؛ چشم‌اندازمان در پیوندهای فردا.</p>
        </div>
        {content.isSuccess && (
          <div className="about-purpose-grid">
            <article className="about-purpose-card mission-card">
              <span className="about-purpose-icon">
                <Icon name="route" />
              </span>
              <span className="about-card-label">مأموریت</span>
              <h3>{content.data.mission_title}</h3>
              <p className="about-content-text">{content.data.mission_body}</p>
              <span className="about-card-mark">01</span>
            </article>
            <article className="about-purpose-card vision-card">
              <span className="about-purpose-icon">
                <Icon name="trend" />
              </span>
              <span className="about-card-label">چشم‌انداز</span>
              <h3>{content.data.vision_title}</h3>
              <p className="about-content-text">{content.data.vision_body}</p>
              <span className="about-card-mark">02</span>
            </article>
          </div>
        )}
      </section>

      <section className="about-ecosystem">
        <div className="about-ecosystem-copy">
          <span className="about-eyebrow">برای چه کسانی؟</span>
          <h2>یک اکوسیستم، با نقش‌های گوناگون در زنجیرهٔ تجارت</h2>
          <p>کارفنسا برای افرادی طراحی شده که در عرضه، خرید، تأمین یا جابه‌جایی کالا نقش دارند.</p>
        </div>
        <div className="about-ecosystem-list">
          {ecosystem.map((item, index) => (
            <span key={item}>
              <i>{String(index + 1).padStart(2, '0')}</i>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="about-services">
        <div className="about-section-heading about-services-heading">
          <div>
            <span className="about-eyebrow">امکانات فعال</span>
            <h2>ابزارهایی برای کشف و پیگیری بازار</h2>
          </div>
          <Link to="/contact/">
            پرسش دربارهٔ خدمات <Icon name="arrow-l" />
          </Link>
        </div>
        <div className="about-services-grid">
          {services.map((service, index) => (
            <Link className="about-service-card" to={service.href} key={service.title}>
              <span className="about-service-index">0{index + 1}</span>
              <span className="about-service-icon">
                <Icon name={service.icon} />
              </span>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
              <span className="about-service-link">
                مشاهدهٔ بخش <Icon name="arrow-l" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="about-principles">
        <div className="about-principles-heading">
          <span className="about-eyebrow">اصول کار</span>
          <h2>اعتماد با شفافیت ساخته می‌شود.</h2>
        </div>
        <div className="about-principles-list">
          <article>
            <span>01</span>
            <div>
              <h3>بررسی پیش از انتشار</h3>
              <p>محصول‌ها و فرصت‌های ارسالی پیش از انتشار عمومی بررسی می‌شوند.</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>نمایش منبع اطلاعات</h3>
              <p>داده‌های آماریِ منتشرشده همراه با منبع و دورهٔ زمانی ارائه می‌شوند.</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>ارتباط از مسیر مشخص</h3>
              <p>درخواست خرید و پیام‌ها از مسیرهای مشخص هر بخش پیگیری می‌شوند.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="about-cta">
        <div>
          <span className="about-eyebrow">قدم بعدی را انتخاب کنید</span>
          <h2>آیندهٔ تجارت، با ارتباطات هوشمند ساخته می‌شود.</h2>
          <p>از جست‌وجوی محصولات شروع کنید یا فرصت تجاری خود را برای بررسی ثبت کنید.</p>
        </div>
        <div className="about-cta-actions">
          <Link className="about-button about-button-white" to="/login/">
            ورود به پلتفرم <Icon name="arrow-l" />
          </Link>
          <Link className="about-button about-button-outline" to="/services/listings/new">
            ثبت محصول <Icon name="factory" />
          </Link>
        </div>
      </section>
    </div>
  )
}

function LazyGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && !('IntersectionObserver' in window),
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="about-globe-lazy" ref={hostRef}>
      {visible && <TradeGlobe />}
    </div>
  )
}
