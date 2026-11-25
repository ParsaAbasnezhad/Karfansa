import { useEffect, useState } from 'react'
import { formatNumber, formatShortDate } from '@/lib/format'
import type { HomeSlide } from '@/lib/types'
import { useSlides } from './data'
import { Icon } from './icons'
import './home-slider.css'

const AUTOPLAY_INTERVAL = 6500

function SlideShow({ slides }: { slides: HomeSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const count = slides.length
  const current = index % count
  const slide = slides[current]

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    updatePreference()
    preference.addEventListener('change', updatePreference)
    const updateVisibility = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      preference.removeEventListener('change', updatePreference)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    if (count < 2 || paused || reducedMotion || !pageVisible) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), AUTOPLAY_INTERVAL)
    return () => window.clearInterval(timer)
  }, [count, index, paused, reducedMotion, pageVisible])

  const goTo = (next: number) => setIndex((next + count) % count)

  return (
    <section
      className="home-slider"
      dir="rtl"
      aria-label="اسلایدر صفحه اصلی"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <article
        key={slide.id}
        className="home-slider-slide"
        role="group"
        aria-roledescription="slide"
        aria-label={`${formatNumber(current + 1)} از ${formatNumber(count)}`}
      >
        {slide.image && failedImage !== slide.image && (
          <img
            className="home-slider-image"
            src={slide.image}
            alt=""
            loading={current === 0 ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailedImage(slide.image)}
          />
        )}
        <div className="home-slider-shade" />
        <div className="home-slider-content">
          <span className="home-slider-kicker">کارفنسا</span>
          <h1>{slide.title}</h1>
          {slide.short_text && <p>{slide.short_text}</p>}
          {slide.description && (
            <details className="home-slider-details">
              <summary>توضیحات بیشتر</summary>
              <p>{slide.description}</p>
            </details>
          )}
          <time className="home-slider-date" dateTime={slide.created_at}>{formatShortDate(slide.created_at)}</time>
        </div>
      </article>

      {count > 1 && (
        <>
          <div className="home-slider-arrows">
            <button type="button" aria-label="اسلاید قبلی" onClick={() => goTo(current - 1)}>
              <Icon name="chev-r" />
            </button>
            <button type="button" aria-label="اسلاید بعدی" onClick={() => goTo(current + 1)}>
              <Icon name="chev-l" />
            </button>
          </div>
          <div className="home-slider-pagination" aria-label="انتخاب اسلاید">
            {slides.map((item, slideIndex) => (
              <button
                key={item.id}
                type="button"
                className={slideIndex === current ? 'is-active' : undefined}
                aria-label={`اسلاید ${formatNumber(slideIndex + 1)}`}
                aria-current={slideIndex === current ? 'true' : undefined}
                onClick={() => goTo(slideIndex)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export function HomeSlider() {
  const slides = useSlides()
  if (slides.isPending) return <div className="home-slider home-slider-loading" role="status" aria-label="در حال بارگذاری اسلایدها" />
  if (slides.isError) {
    return (
      <div className="home-slider home-slider-message" role="alert">
        <p>اسلایدهای صفحه اصلی بارگذاری نشدند.</p>
        <button type="button" onClick={() => void slides.refetch()}>تلاش دوباره</button>
      </div>
    )
  }
  if (!slides.data.results.length) {
    return <div className="home-slider home-slider-message" role="status">اسلاید فعالی برای نمایش وجود ندارد.</div>
  }
  return <SlideShow slides={slides.data.results} />
}
