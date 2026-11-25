import { useState } from 'react'
import { AppLink } from '@/components/AppLink'
import { Icon } from './icons'
import { ErrorBox, SectionHead, Skeleton } from './parts'
import {
  useAnalysisAuthors,
  useAnalysisCategories,
  useAnalysisReports,
  useFeaturedAnalysis,
} from '@/features/analysis/api'
import { AnalysisReportCard } from '@/features/analysis/AnalysisReportCard'
import { formatAnalysisDate } from '@/features/analysis/api'
import { formatNumber } from '@/lib/format'
import { URLS } from '@/lib/site'
import '@/features/analysis/analysis.css'

export function AnalysisSection() {
  const [category, setCategory] = useState('')
  const categories = useAnalysisCategories()
  const reports = useAnalysisReports({ category, page_size: 4, ordering: 'latest' })
  const featuredReports = useFeaturedAnalysis()
  const authors = useAnalysisAuthors()
  const items = reports.data?.items ?? []
  const featured =
    (category ? items.find((report) => report.is_featured) : featuredReports.data?.[0]) ??
    items.find((report) => report.is_featured) ??
    items[0]
  const articles = items.filter((report) => report.slug !== featured?.slug).slice(0, 3)

  return (
    <section className="panel sec analysis-home" id="analysis" dir="rtl">
      <SectionHead
        icon="bars"
        title="تحلیل و گزارش"
        sub="تحلیل‌های اقتصادی و گزارش‌های بازار با تکیه بر داده و نگاه کارشناسی"
      >
        <AppLink className="link" href={URLS.analysisAll}>
          <Icon name="arrow-l" />
          آرشیو تحلیل‌ها
        </AppLink>
      </SectionHead>

      <div className="analysis-category-rail" aria-label="دسته‌بندی تحلیل‌ها">
        <button
          type="button"
          className={!category ? 'is-active' : ''}
          aria-pressed={!category}
          onClick={() => setCategory('')}
        >
          همه تحلیل‌ها
        </button>
        {(categories.data ?? []).map((item) => (
          <button
            type="button"
            className={category === item.slug ? 'is-active' : ''}
            aria-pressed={category === item.slug}
            key={item.slug}
            onClick={() => setCategory(category === item.slug ? '' : item.slug)}
          >
            {item.name}
          </button>
        ))}
      </div>

      {reports.isLoading ? (
        <div className="analysis-home-skeleton">
          <Skeleton height={360} />
          <Skeleton height={240} />
        </div>
      ) : reports.isError ? (
        <ErrorBox onRetry={() => void reports.refetch()} />
      ) : items.length === 0 ? (
        <div className="analysis-empty-inline">
          <Icon name="file" />
          <div>
            <strong>تحلیلی در این دسته منتشر نشده است</strong>
            <span>با انتخاب دسته‌ای دیگر، گزارش‌های منتشرشده را ببینید.</span>
          </div>
        </div>
      ) : (
        <div className="analysis-home-layout">
          <div className="analysis-home-main">
            {featured && (
              <article className="analysis-featured">
                <AppLink
                  className="analysis-featured-media"
                  href={`/analysis/${encodeURIComponent(featured.slug)}`}
                  aria-label={`مطالعه ${featured.title}`}
                >
                  {featured.cover_image ? (
                    <img src={featured.cover_image} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">
                      <Icon name="bars" />
                    </span>
                  )}
                  <span className="analysis-featured-label">ویژه کارفنسا</span>
                </AppLink>
                <div className="analysis-featured-copy">
                  {featured.category && <span className="analysis-category">{featured.category.name}</span>}
                  <h3>
                    <AppLink href={`/analysis/${encodeURIComponent(featured.slug)}`}>
                      {featured.title}
                    </AppLink>
                  </h3>
                  <p>{featured.short_description}</p>
                  <div className="analysis-featured-meta">
                    <span>{featured.author?.full_name || 'تحریریه کارفنسا'}</span>
                    <span>{formatAnalysisDate(featured.published_at)}</span>
                    <span>{formatNumber(featured.reading_minutes)} دقیقه مطالعه</span>
                  </div>
                  <AppLink
                    className="analysis-read-button"
                    href={`/analysis/${encodeURIComponent(featured.slug)}`}
                  >
                    مطالعه گزارش
                    <Icon name="arrow-l" />
                  </AppLink>
                </div>
              </article>
            )}
            {articles.length > 0 && (
              <div className="analysis-home-cards">
                {articles.map((item) => (
                  <AnalysisReportCard report={item} key={item.id} />
                ))}
              </div>
            )}
          </div>
          <aside className="analysis-home-sidebar">
            <section className="analysis-side-panel">
              <div className="analysis-side-title">
                <h3>تازه‌ترین گزارش‌ها</h3>
                <AppLink href={URLS.analysisAll} aria-label="مشاهده همه گزارش‌ها">
                  <Icon name="arrow-l" />
                </AppLink>
              </div>
              {items.slice(0, 4).map((item) => (
                <AppLink
                  className="analysis-latest"
                  href={`/analysis/${encodeURIComponent(item.slug)}`}
                  key={item.id}
                >
                  <span>{item.category?.name || 'تحلیل اقتصادی'}</span>
                  <strong>{item.title}</strong>
                  <small>{formatAnalysisDate(item.published_at)}</small>
                </AppLink>
              ))}
            </section>
            <section className="analysis-side-panel">
              <div className="analysis-side-title">
                <h3>تحلیلگران</h3>
              </div>
              {authors.isLoading ? (
                <Skeleton height={108} />
              ) : authors.isError ? (
                <div className="analysis-side-error">
                  <span>دریافت فهرست تحلیلگران ممکن نشد.</span>
                  <button type="button" onClick={() => void authors.refetch()}>
                    تلاش دوباره
                  </button>
                </div>
              ) : authors.data?.length ? (
                authors.data.slice(0, 4).map((author) => (
                  <div className="analysis-analyst" key={author.full_name}>
                    <span className="analysis-analyst-avatar">
                      {author.profile_image ? (
                        <img src={author.profile_image} alt="" loading="lazy" />
                      ) : (
                        author.full_name.slice(0, 1)
                      )}
                    </span>
                    <span>
                      <strong>{author.full_name}</strong>
                      <small>{author.position || 'تحلیلگر اقتصادی'}</small>
                    </span>
                  </div>
                ))
              ) : (
                <p className="analysis-no-authors">تحلیلگر معرفی‌شده‌ای در گزارش‌ها ثبت نشده است.</p>
              )}
            </section>
          </aside>
        </div>
      )}
    </section>
  )
}
