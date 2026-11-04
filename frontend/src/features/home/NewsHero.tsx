import { useEffect, useState } from 'react'
import { formatNumber, formatShortDate } from '@/lib/format'
import type { HomeSlide } from '@/lib/types'
import { useSlides } from './data'
import { Icon } from './icons'
import { ErrorBox, Skeleton } from './parts'

function SlideShow({ slides }: { slides: HomeSlide[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length

  useEffect(() => {
    if (paused || count < 2) return undefined
    const id = setInterval(() => setCurrent((c) => (c + 1) % count), 6500)
    return () => clearInterval(id)
  }, [paused, count, current])

  const go = (i: number) => setCurrent((i + count) % count)

  return (
    <div
      className="slider"
      aria-roledescription="carousel"
      aria-label="خبرهای برگزیده"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <article
          key={s.id}
          className={'slide' + (i === current ? ' on' : '')}
          style={{ backgroundImage: s.image ? `url(${s.image})` : undefined }}
          aria-hidden={i !== current}
          aria-label={`${formatNumber(i + 1)} از ${formatNumber(count)}`}
        >
          <h2 className="st">{s.title}</h2>
          <p>{s.short_text}</p>
          <details className="slide-details">
            <summary>توضیحات بیشتر</summary>
            <p>{s.description}</p>
          </details>
          <div className="meta">
            <time dateTime={s.created_at}>{formatShortDate(s.created_at)}</time>
          </div>
        </article>
      ))}
      <button type="button" className="arrow pv" aria-label="قبلی" onClick={() => go(current - 1)}>
        <Icon name="chev-r" />
      </button>
      <button type="button" className="arrow nx" aria-label="بعدی" onClick={() => go(current + 1)}>
        <Icon name="chev-l" />
      </button>
      <div className="dots">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={i === current ? 'on' : ''}
            aria-label={`اسلاید ${formatNumber(i + 1)}`}
            aria-current={i === current}
            onClick={() => go(i)}
          />
        ))}
      </div>
      <div className="count">
        {formatNumber(current + 1)} / {formatNumber(count)}
      </div>
    </div>
  )
}

/** Hero slider with the top stories. */
export function NewsHero() {
  const { data, isError, refetch } = useSlides()
  if (data?.results.length) return <SlideShow slides={data.results} />
  if (data) return <div className="slider slide-empty">اسلاید فعالی برای نمایش وجود ندارد.</div>
  if (isError) return <ErrorBox onRetry={() => void refetch()} />
  return <Skeleton height={400} />
}
