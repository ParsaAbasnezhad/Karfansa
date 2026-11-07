import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '@/features/home/icons'
import { formatNumber, formatShortDate } from '@/lib/format'
import { useRSSNews } from './data'
import './news.css'

export function NewsPage() {
  const [topic, setTopic] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data, isPending, isError, refetch, isFetching } = useRSSNews(topic, query, page)

  useEffect(() => {
    document.title = 'اخبار اقتصادی | کارفنسا'
  }, [])

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setQuery(searchInput.trim())
  }

  const chooseTopic = (nextTopic: string) => {
    setTopic(nextTopic)
    setPage(1)
  }

  return (
    <section className="news-page" aria-labelledby="news-title">
      <header className="news-hero">
        <div className="news-hero-copy">
          <span className="news-eyebrow">
            <span className="news-live-dot" />
            گزیدهٔ خبرهای اقتصادی
          </span>
          <h1 id="news-title">اخبار اقتصادی</h1>
          <p>خبرهای مرتبط دریافت‌شده از منابع RSS، پس از بررسی موضوعی و پالایش خودکار</p>
        </div>
        <div className="news-hero-stat" aria-live="polite">
          <strong>{formatNumber(data?.count ?? 0)}</strong>
          <span>خبر تأییدشده</span>
        </div>
      </header>

      <div className="news-toolbar">
        <form className="news-search" onSubmit={search} role="search">
          <Icon name="search" />
          <label className="sr-only" htmlFor="news-search">
            جست‌وجو در اخبار
          </label>
          <input
            id="news-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="جست‌وجو در عنوان خبرها..."
          />
          <button type="submit">جست‌وجو</button>
        </form>
        <span className="news-refresh" aria-live="polite">
          {isFetching && !isPending ? 'در حال به‌روزرسانی…' : 'به‌روزترین خبرها'}
        </span>
      </div>

      <nav className="news-topics" aria-label="فیلتر موضوع خبر">
        <button
          type="button"
          className={!topic ? 'active' : ''}
          aria-pressed={!topic}
          onClick={() => chooseTopic('')}
        >
          همهٔ موضوع‌ها
        </button>
        {(data?.topics ?? []).map((item) => (
          <button
            type="button"
            className={topic === item ? 'active' : ''}
            aria-pressed={topic === item}
            key={item}
            onClick={() => chooseTopic(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {isError ? (
        <div className="news-state news-error" role="alert">
          <Icon name="news" />
          <strong>دریافت خبرها ممکن نشد</strong>
          <span>اتصال به سرویس را بررسی کنید و دوباره تلاش کنید.</span>
          <button type="button" onClick={() => void refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : isPending ? (
        <div className="news-grid" aria-label="در حال دریافت خبرها">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="news-card news-card-skeleton" key={index}>
              <span className="skel news-skel-label" />
              <span className="skel news-skel-title" />
              <span className="skel news-skel-line" />
              <span className="skel news-skel-line short" />
            </div>
          ))}
        </div>
      ) : data?.results.length ? (
        <>
          <div className="news-grid" aria-live="polite">
            {data.results.map((item) => {
              const publishedAt = item.published_at ?? item.fetched_at
              return (
                <article className="news-card" key={item.id}>
                  <div className="news-card-top">
                    <span className="news-topic">{item.topic}</span>
                    <span className="news-score" title="امتیاز ارتباط موضوعی">
                      ارتباط {formatNumber(item.score)}٪
                    </span>
                  </div>
                  <h2>
                    <a href={item.original_url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                      <span className="sr-only"> (در {item.source_name})</span>
                    </a>
                  </h2>
                  {item.summary && <p className="news-summary">{item.summary}</p>}
                  <footer className="news-card-meta">
                    <span>
                      <Icon name="building" />
                      {item.source_name}
                    </span>
                    <time dateTime={publishedAt}>
                      <Icon name="clock" />
                      {formatShortDate(publishedAt)}
                    </time>
                    <a
                      className="news-read-link"
                      href={item.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`خواندن خبر ${item.title} در ${item.source_name}`}
                    >
                      مطالعهٔ خبر
                      <Icon name="arrow-l" />
                    </a>
                  </footer>
                </article>
              )
            })}
          </div>

          {data.total_pages > 1 && (
            <nav className="news-pagination" aria-label="صفحه‌بندی خبرها">
              <button
                type="button"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                <Icon name="chev-r" />
                قبلی
              </button>
              <span>
                صفحهٔ {formatNumber(data.page)} از {formatNumber(data.total_pages)}
              </span>
              <button
                type="button"
                disabled={page >= data.total_pages || isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                بعدی
                <Icon name="chev-l" />
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="news-state">
          <Icon name="news" />
          <strong>{query || topic ? 'خبری با این فیلتر پیدا نشد' : 'هنوز خبری دریافت نشده است'}</strong>
          <span>
            {query || topic
              ? 'عبارت جست‌وجو یا موضوع دیگری را امتحان کنید.'
              : 'خبرهای RSS پس از دریافت و تأیید موضوعی در این صفحه نمایش داده می‌شوند.'}
          </span>
        </div>
      )}
    </section>
  )
}
