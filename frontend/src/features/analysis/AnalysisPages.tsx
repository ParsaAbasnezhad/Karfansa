import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { Breadcrumb, DirectoryEmpty, DirectoryError } from '@/features/directory/shared'
import {
  DetailPageSkeleton,
  ShareButton,
  useDocumentTitle,
} from '@/features/directory/detail-shared'
import { Icon } from '@/features/home/icons'
import { ApiError } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import { AnalysisReportCard } from './AnalysisReportCard'
import {
  ANALYSIS_REPORT_TYPES,
  formatAnalysisDate,
  formatFileSize,
  useAnalysisAuthors,
  useAnalysisCategories,
  useAnalysisDetail,
  useAnalysisReports,
} from './api'
import type { AnalysisAttachment, AnalysisReport } from './types'
import './analysis.css'

const PAGE_SIZE = 12

function reportTypeName(value: string) {
  return ANALYSIS_REPORT_TYPES.find((item) => item.value === value)?.label ?? 'تحلیل اقتصادی'
}

function AnalysisCardsSkeleton() {
  return (
    <div className="analysis-archive-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="analysis-skeleton-card" key={index}>
          <span />
          <div>
            <i />
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AnalysisArchivePage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const reportType = params.get('type') ?? ''
  const ordering = params.get('ordering') ?? 'latest'
  const page = Math.max(Number(params.get('page') || 1), 1)
  const [searchDraft, setSearchDraft] = useState(search)
  const categories = useAnalysisCategories()
  const reports = useAnalysisReports({
    search,
    category,
    report_type: reportType,
    ordering,
    page,
    page_size: PAGE_SIZE,
  })

  useDocumentTitle(undefined, 'تحلیل و گزارش | کارفنسا')

  const write = (values: Record<string, string | number>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) {
      if (!value || value === 'latest' || value === 1) next.delete(key)
      else next.set(key, String(value))
    }
    setParams(next)
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    write({ q: searchDraft.trim(), page: 1 })
  }

  const clearFilters = () => {
    setSearchDraft('')
    setParams(new URLSearchParams())
  }

  return (
    <main className="analysis-page" dir="rtl">
      <Breadcrumb items={[{ label: 'تحلیل و گزارش' }]} />
      <header className="analysis-archive-hero">
        <p>مرکز پژوهش و بینش اقتصادی کارفنسا</p>
        <h1>تحلیل و گزارش</h1>
        <span>
          گزارش‌های تخصصی و تحلیل‌های بازار برای تصمیم‌گیری آگاهانه‌تر در اقتصاد و تجارت.
        </span>
        <form className="analysis-search" onSubmit={submitSearch} role="search">
          <Icon name="search" />
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="جست‌وجو در عنوان، خلاصه یا نام تحلیلگر"
            aria-label="جست‌وجو در تحلیل‌ها و گزارش‌ها"
          />
          <button type="submit">جست‌وجو</button>
        </form>
      </header>

      <div className="analysis-filter-panel">
        <div className="analysis-filter-group">
          <span>دسته‌بندی</span>
          <div className="analysis-category-rail">
            <button
              type="button"
              className={!category ? 'is-active' : ''}
              aria-pressed={!category}
              onClick={() => write({ category: '', page: 1 })}
            >
              همه
            </button>
            {(categories.data ?? []).map((item) => (
              <button
                type="button"
                key={item.slug}
                className={category === item.slug ? 'is-active' : ''}
                aria-pressed={category === item.slug}
                onClick={() => write({ category: category === item.slug ? '' : item.slug, page: 1 })}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <div className="analysis-filter-controls">
          <label>
            نوع گزارش
            <select
              value={reportType}
              onChange={(event) => write({ type: event.target.value, page: 1 })}
            >
              <option value="">همه انواع</option>
              {ANALYSIS_REPORT_TYPES.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            مرتب‌سازی
            <select
              value={ordering}
              onChange={(event) => write({ ordering: event.target.value, page: 1 })}
            >
              <option value="latest">تازه‌ترین</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="most_viewed">پربازدیدترین</option>
            </select>
          </label>
          {(search || category || reportType) && (
            <button className="analysis-clear" type="button" onClick={clearFilters}>
              پاک‌کردن فیلترها
            </button>
          )}
        </div>
      </div>

      <div className="analysis-archive-heading">
        <div>
          <h2>آرشیو پژوهش‌ها</h2>
          <p>
            {reports.data
              ? `${formatNumber(reports.data.count)} تحلیل و گزارش`
              : 'گزارش‌های منتشرشده کارفنسا'}
          </p>
        </div>
        {reports.isFetching && reports.data && <span className="analysis-refreshing">در حال به‌روزرسانی…</span>}
      </div>

      {reports.isLoading ? (
        <AnalysisCardsSkeleton />
      ) : reports.isError ? (
        <DirectoryError
          title="دریافت آرشیو تحلیل‌ها ممکن نشد"
          message={
            reports.error instanceof ApiError
              ? reports.error.message
              : 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.'
          }
          onRetry={() => void reports.refetch()}
        />
      ) : reports.data?.items.length ? (
        <>
          <div className={reports.isFetching ? 'analysis-archive-grid is-fetching' : 'analysis-archive-grid'}>
            {reports.data.items.map((report) => (
              <AnalysisReportCard report={report} key={report.id} />
            ))}
          </div>
          {reports.data.total_pages > 1 && (
            <nav className="analysis-pagination" aria-label="صفحه‌های آرشیو">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => write({ page: page - 1 })}
              >
                <Icon name="chev-r" />
                قبلی
              </button>
              <span>
                صفحه {formatNumber(page)} از {formatNumber(reports.data.total_pages)}
              </span>
              <button
                type="button"
                disabled={page >= reports.data.total_pages}
                onClick={() => write({ page: page + 1 })}
              >
                بعدی
                <Icon name="chev-l" />
              </button>
            </nav>
          )}
        </>
      ) : (
        <DirectoryEmpty
          title="گزارشی با این مشخصات پیدا نشد"
          body="جست‌وجو یا فیلترهای انتخاب‌شده را تغییر دهید."
          action={
            <button className="analysis-primary-button" type="button" onClick={clearFilters}>
              پاک‌کردن فیلترها
            </button>
          }
        />
      )}
    </main>
  )
}

function prepareArticleContent(content: string) {
  const parsed = new DOMParser().parseFromString(content, 'text/html')
  const headings = Array.from(parsed.body.querySelectorAll('h2, h3')).map((heading, index) => {
    const id = `report-heading-${index + 1}`
    heading.id = id
    return { id, title: heading.textContent?.trim() || '', level: heading.tagName.toLowerCase() }
  })
  return { content: parsed.body.innerHTML, headings }
}

function AttachmentDownload({ item, slug }: { item: AnalysisAttachment; slug: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const base = String(import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')
      const path = `/v1/analysis/${encodeURIComponent(slug)}/attachments/${encodeURIComponent(item.id)}/download/`
      const response = await fetch(`${base}${path}`, { credentials: 'same-origin' })
      if (!response.ok) {
        const message = response.status === 429
          ? 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.'
          : response.status === 404
            ? 'این فایل دیگر در دسترس نیست.'
            : 'دریافت فایل انجام نشد. دوباره تلاش کنید.'
        throw new Error(message)
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = item.original_filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دریافت فایل انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="analysis-attachment-wrap">
      <div className="analysis-attachment">
        <span className="analysis-file-icon">
          <Icon name="file" />
          <small>{item.file_type}</small>
        </span>
        <span className="analysis-attachment-info">
          <strong>{item.original_filename}</strong>
          <small>
            {item.file_type} · {formatFileSize(item.file_size)}
          </small>
        </span>
        <button type="button" onClick={() => void download()} disabled={busy}>
          <Icon name={busy ? 'clock' : 'arrow-up'} />
          {busy ? 'در حال دریافت' : 'دریافت فایل'}
        </button>
      </div>
      {error && <p className="analysis-download-error" role="alert">{error}</p>}
    </div>
  )
}

function RelatedReport({ item }: { item: AnalysisReport }) {
  return (
    <Link className="analysis-related" to={`/analysis/${encodeURIComponent(item.slug)}`}>
      {item.category && <span>{item.category.name}</span>}
      <strong>{item.title}</strong>
      <small>{formatAnalysisDate(item.published_at)}</small>
    </Link>
  )
}

export function AnalysisDetailPage() {
  const { slug = '' } = useParams()
  const query = useAnalysisDetail(slug)
  const authors = useAnalysisAuthors()
  const latestReports = useAnalysisReports({ page_size: 3, ordering: 'latest' })
  const item = query.data?.report
  const content = item?.content ?? ''
  const article = useMemo(
    () => prepareArticleContent(content),
    [content],
  )

  useDocumentTitle(item?.seo_title || item?.title, 'تحلیل اقتصادی | کارفنسا')

  if (query.isLoading) {
    return (
      <main className="analysis-page analysis-detail-page" dir="rtl">
        <DetailPageSkeleton />
      </main>
    )
  }

  if (query.isError || !item) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <main className="analysis-page analysis-detail-page" dir="rtl">
        <Breadcrumb items={[{ label: 'تحلیل و گزارش', to: '/analysis' }, { label: 'گزارش' }]} />
        {notFound ? (
          <DirectoryEmpty
            title="این گزارش در دسترس نیست"
            body="ممکن است گزارش بایگانی شده باشد یا نشانی آن تغییر کرده باشد."
            action={<Link className="analysis-primary-button" to="/analysis">بازگشت به آرشیو</Link>}
          />
        ) : (
          <DirectoryError
            title="بارگذاری گزارش ممکن نشد"
            message={
              query.error instanceof ApiError ? query.error.message : 'ارتباط با سرور برقرار نشد.'
            }
            onRetry={() => void query.refetch()}
          />
        )}
      </main>
    )
  }

  const related = query.data?.related ?? []
  const latest = (authors.data ?? []).slice(0, 3)

  return (
    <main className="analysis-page analysis-detail-page" dir="rtl">
      <Breadcrumb
        items={[
          { label: 'تحلیل و گزارش', to: '/analysis' },
          ...(item.category ? [{ label: item.category.name, to: `/analysis?category=${item.category.slug}` }] : []),
          { label: item.title },
        ]}
      />
      <header className="analysis-detail-header">
        <div className="analysis-detail-meta">
          {item.category && <Link to={`/analysis?category=${item.category.slug}`}>{item.category.name}</Link>}
          <span>{reportTypeName(item.report_type)}</span>
        </div>
        <h1>{item.title}</h1>
        <p className="analysis-detail-summary">{item.short_description}</p>
        <div className="analysis-detail-byline">
          <span className="analysis-author-avatar">
            {item.author?.profile_image ? (
              <img src={item.author.profile_image} alt="" />
            ) : (
              item.author?.full_name.slice(0, 1) || 'ک'
            )}
          </span>
          <span className="analysis-author-byline">
            <strong>{item.author?.full_name || 'تحریریه کارفنسا'}</strong>
            {item.author?.position && <small>{item.author.position}</small>}
          </span>
          <span>{formatAnalysisDate(item.published_at)}</span>
          <span>{formatNumber(item.reading_minutes)} دقیقه مطالعه</span>
          <ShareButton title={item.title} />
        </div>
      </header>

      {item.cover_image && (
        <figure className="analysis-detail-cover">
          <img src={item.cover_image} alt="" loading="eager" />
        </figure>
      )}

      <div className="analysis-reading-layout">
        <article className="analysis-article">
          <div
            className="analysis-rich-content"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
          {item.attachments.length > 0 && (
            <section className="analysis-downloads" aria-labelledby="analysis-download-title">
              <div className="analysis-detail-section-title">
                <span>منابع و فایل‌ها</span>
                <h2 id="analysis-download-title">دریافت فایل‌های گزارش</h2>
              </div>
              <div className="analysis-attachments">
                {item.attachments.map((attachment) => (
                  <AttachmentDownload item={attachment} slug={item.slug} key={attachment.id} />
                ))}
              </div>
            </section>
          )}
        </article>
        <aside className="analysis-reading-sidebar">
          {article.headings.length > 2 && (
            <nav className="analysis-toc" aria-label="فهرست مطالب">
              <h2>در این گزارش</h2>
              {article.headings.map((heading) => (
                <a
                  className={heading.level === 'h3' ? 'is-subheading' : ''}
                  href={`#${heading.id}`}
                  key={heading.id}
                >
                  {heading.title}
                </a>
              ))}
            </nav>
          )}
          {item.author && (
            <section className="analysis-author-panel">
              <h2>درباره تحلیلگر</h2>
              <div className="analysis-author-profile">
                <span className="analysis-author-avatar">
                  {item.author.profile_image ? (
                    <img src={item.author.profile_image} alt="" loading="lazy" />
                  ) : (
                    item.author.full_name.slice(0, 1)
                  )}
                </span>
                <span>
                  <strong>{item.author.full_name}</strong>
                  {item.author.position && <small>{item.author.position}</small>}
                </span>
              </div>
              {item.author.biography && <p>{item.author.biography}</p>}
            </section>
          )}
          {related.length > 0 && (
            <section className="analysis-author-panel">
              <h2>مطالعه بیشتر</h2>
              {related.map((report) => <RelatedReport item={report} key={report.id} />)}
            </section>
          )}
          {latestReports.data?.items.length ? (
            <section className="analysis-author-panel">
              <h2>تازه‌ترین تحلیل‌ها</h2>
              {latestReports.data.items
                .filter((report) => report.slug !== item.slug)
                .slice(0, 3)
                .map((report) => <RelatedReport item={report} key={report.id} />)}
            </section>
          ) : null}
          {latest.length > 0 && (
            <section className="analysis-author-panel">
              <h2>تحلیلگران کارفنسا</h2>
              {latest.map((author) => (
                <div className="analysis-analyst" key={author.full_name}>
                  <span className="analysis-analyst-avatar">
                    {author.profile_image ? <img src={author.profile_image} alt="" loading="lazy" /> : author.full_name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{author.full_name}</strong>
                    <small>{author.position}</small>
                  </span>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
      {item.attachments.length === 0 && (
        <div className="analysis-downloads analysis-downloads-empty">
          <Icon name="file" />
          <span>برای این گزارش فایل جداگانه‌ای ثبت نشده است.</span>
        </div>
      )}
    </main>
  )
}
