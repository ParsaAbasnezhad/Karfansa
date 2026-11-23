import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatNumber, formatShortDate } from '@/lib/format'
import { BusinessIcon, type BusinessIconName } from './BusinessIcons'
import { statusLabels } from './BusinessDashboardStatus'

export type Listing = {
  id: number
  title: string
  status: string
  status_display?: string
  listing_kind: string
  is_active: boolean
  created_at: string
}

export type Inquiry = {
  id: number
  listing_id: number
  listing_title: string
  listing_slug: string
  buyer_name: string
  message: string
  status: string
  status_display: string
  created_at: string
}

export type Opportunity = {
  id: number
  title: string
  review_status: string
  is_published: boolean
}

const listingStatus: Record<string, string> = {
  draft: 'پیش‌نویس',
  pending_review: 'در انتظار بررسی',
  approved: 'تأییدشده',
  rejected: 'ردشده',
  archived: 'بایگانی‌شده',
}

const inquiryStatus: Record<string, string> = {
  new: 'جدید',
  read: 'خوانده‌شده',
  replied: 'پاسخ‌داده‌شده',
  closed: 'بسته‌شده',
}

export function PanelHeading({
  title,
  eyebrow,
  action,
}: {
  title: string
  eyebrow?: string
  action?: ReactNode
}) {
  return (
    <div className="bos-panel-heading">
      <div>
        {eyebrow && <span className="bos-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: BusinessIconName
  title: string
  description: string
}) {
  return (
    <div className="bos-empty">
      <BusinessIcon name={icon} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

export function Status({ value, label }: { value: string; label?: string }) {
  return <span className={`bos-status is-${value}`}>{label ?? statusLabels[value] ?? value}</span>
}

export function Metric({
  icon,
  label,
  value,
  detail,
  highlight = false,
}: {
  icon: BusinessIconName
  label: string
  value: number | null
  detail: string
  highlight?: boolean
}) {
  return (
    <article className={`bos-metric${highlight ? ' is-highlight' : ''}`}>
      <div className="bos-metric-top">
        <span>{label}</span>
        <BusinessIcon name={icon} />
      </div>
      <strong className="bos-number" dir="ltr">
        {value === null ? '—' : formatNumber(value)}
      </strong>
      <small>{detail}</small>
    </article>
  )
}

export function ListingsPanel({
  listings,
  loading,
  error,
  canPublish,
  full,
  onAll,
}: {
  listings: Listing[]
  loading: boolean
  error: boolean
  canPublish: boolean
  full: boolean
  onAll: () => void
}) {
  const rows = full ? listings : listings.slice(0, 4)
  return (
    <section className="bos-panel bos-listings-panel">
      <PanelHeading
        eyebrow="CATALOG"
        title="محصولات و خدمات"
        action={
          full ? (
            canPublish && (
              <Link
                className="bos-small-primary"
                to="/services/listings/new?kind=product&next=business"
              >
                <BusinessIcon name="plus" /> افزودن محصول
              </Link>
            )
          ) : (
            <button className="bos-text-action" type="button" onClick={onAll}>
              همه آگهی‌ها <BusinessIcon name="arrow-left" />
            </button>
          )
        }
      />
      {loading ? (
        <div className="bos-skeleton bos-row-skeleton" />
      ) : error ? (
        <p className="bos-error">دریافت آگهی‌ها انجام نشد.</p>
      ) : rows.length ? (
        <ul className="bos-row-list">
          {rows.map((item) => (
            <li key={item.id}>
              <span className="bos-row-symbol">
                <BusinessIcon name={item.listing_kind === 'service' ? 'briefcase' : 'package'} />
              </span>
              <span className="bos-row-main">
                <Link to={`/services/listings/${item.id}/edit`}>{item.title}</Link>
                <small>
                  {item.listing_kind === 'service' ? 'خدمت' : 'محصول'}
                  {item.created_at && ` · ${formatShortDate(item.created_at)}`}
                </small>
              </span>
              <Status
                value={item.status}
                label={item.status_display || listingStatus[item.status]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="package"
          title="هنوز آگهی ثبت نشده"
          description="محصولات و خدمات این هویت اینجا نمایش داده می‌شوند."
        />
      )}
      {full && canPublish && (
        <Link className="bos-inline-action" to="/services/listings/new?kind=service&next=business">
          <BusinessIcon name="plus" /> افزودن خدمت
        </Link>
      )}
    </section>
  )
}

export function TradePanel({
  opportunities,
  loading,
  error,
  full,
  onAll,
}: {
  opportunities: Opportunity[]
  loading: boolean
  error: boolean
  full: boolean
  onAll: () => void
}) {
  const rows = full ? opportunities : opportunities.slice(0, 4)
  return (
    <section className="bos-panel bos-trade-panel">
      <PanelHeading
        eyebrow="TRADE DESK"
        title="فرصت‌های تجاری"
        action={
          !full && (
            <button className="bos-text-action" type="button" onClick={onAll}>
              مدیریت فرصت‌ها <BusinessIcon name="arrow-left" />
            </button>
          )
        }
      />
      {loading ? (
        <div className="bos-skeleton bos-row-skeleton" />
      ) : error ? (
        <p className="bos-error">دریافت فرصت‌ها انجام نشد.</p>
      ) : rows.length ? (
        <ul className="bos-row-list">
          {rows.map((item) => (
            <li key={item.id}>
              <span className="bos-row-symbol">
                <BusinessIcon name="trade" />
              </span>
              <span className="bos-row-main">
                <strong>{item.title}</strong>
                <small>فرصت تجاری شرکت</small>
              </span>
              <Status
                value={item.is_published ? 'verified' : item.review_status}
                label={
                  item.is_published
                    ? 'منتشرشده'
                    : (statusLabels[item.review_status] ?? item.review_status)
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="trade"
          title="هنوز فرصتی ثبت نشده"
          description="فرصت‌های تجاری این شرکت اینجا نمایش داده می‌شوند."
        />
      )}
    </section>
  )
}

export function InquiriesPanel({
  inquiries,
  loading,
  error,
  full,
  onAll,
}: {
  inquiries: Inquiry[]
  loading: boolean
  error: boolean
  full: boolean
  onAll: () => void
}) {
  const rows = full ? inquiries : inquiries.slice(0, 4)
  return (
    <section className="bos-panel bos-inquiries-panel">
      <PanelHeading
        eyebrow="CUSTOMER DESK"
        title="درخواست‌های مشتریان"
        action={
          !full && (
            <button className="bos-text-action" type="button" onClick={onAll}>
              همه درخواست‌ها <BusinessIcon name="arrow-left" />
            </button>
          )
        }
      />
      {loading ? (
        <div className="bos-skeleton bos-row-skeleton" />
      ) : error ? (
        <p className="bos-error">دریافت درخواست‌ها انجام نشد.</p>
      ) : rows.length ? (
        <ul className="bos-row-list">
          {rows.map((item) => (
            <li key={item.id}>
              <span className="bos-row-symbol">
                <BusinessIcon name="message" />
              </span>
              <span className="bos-row-main">
                <strong>{item.listing_title}</strong>
                <small>
                  {item.buyer_name} · {formatShortDate(item.created_at)}
                </small>
                {full && (
                  <details className="bos-inquiry-detail">
                    <summary>نمایش پیام</summary>
                    <p>{item.message}</p>
                    <Link to={`/services/listings/${encodeURIComponent(item.listing_slug)}`}>
                      مشاهده آگهی <BusinessIcon name="arrow-up-left" />
                    </Link>
                  </details>
                )}
              </span>
              <Status
                value={item.status}
                label={item.status_display || inquiryStatus[item.status]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="inbox"
          title="درخواستی دریافت نشده"
          description="پیام‌های مربوط به آگهی‌های همین هویت اینجا نمایش داده می‌شوند."
        />
      )}
    </section>
  )
}

export function SubmittedPanel({
  inquiries,
  loading,
  error,
}: {
  inquiries: Inquiry[]
  loading: boolean
  error: boolean
}) {
  return (
    <section className="bos-panel bos-submitted-panel">
      <PanelHeading eyebrow="ACCOUNT REQUESTS" title="درخواست‌های ارسالی حساب" />
      <p className="bos-muted">درخواست‌های خریدی که با حساب کاربری خود فرستاده‌اید.</p>
      {loading ? (
        <div className="bos-skeleton bos-row-skeleton" />
      ) : error ? (
        <p className="bos-error">دریافت درخواست‌های ارسالی انجام نشد.</p>
      ) : inquiries.length ? (
        <ul className="bos-row-list">
          {inquiries.map((item) => (
            <li key={item.id}>
              <span className="bos-row-symbol">
                <BusinessIcon name="arrow-up-left" />
              </span>
              <span className="bos-row-main">
                <Link to={`/services/listings/${encodeURIComponent(item.listing_slug)}`}>
                  {item.listing_title}
                </Link>
                <small>{formatShortDate(item.created_at)}</small>
              </span>
              <Status
                value={item.status}
                label={item.status_display || inquiryStatus[item.status]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="message"
          title="درخواستی ارسال نشده"
          description="درخواست‌های ارسالی حساب شما اینجا نمایش داده می‌شوند."
        />
      )}
    </section>
  )
}

export function InquiryChart({
  inquiries,
  days,
  loading,
  error,
}: {
  inquiries: Inquiry[]
  days: 7 | 30
  loading: boolean
  error: boolean
}) {
  const [now] = useState(() => Date.now())
  const span = days * 24 * 60 * 60 * 1000
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const from = now - span + (span / 7) * index
    const to = now - span + (span / 7) * (index + 1)
    return {
      count: inquiries.filter((item) => {
        const value = Date.parse(item.created_at)
        return value >= from && value < to
      }).length,
      label: formatShortDate(from),
    }
  })
  const total = buckets.reduce((sum, item) => sum + item.count, 0)
  const max = Math.max(1, ...buckets.map((item) => item.count))
  if (loading) return <div className="bos-skeleton bos-chart-skeleton" />
  if (error) return <p className="bos-error">داده‌های این بازه در دسترس نیست.</p>
  return (
    <div className="bos-chart-wrap">
      <div className="bos-chart-summary">
        <strong>{formatNumber(total)}</strong>
        <span>درخواست دریافت‌شده در {formatNumber(days)} روز گذشته</span>
      </div>
      <div
        className="bos-chart"
        role="img"
        aria-label={`${formatNumber(total)} درخواست دریافت‌شده در ${formatNumber(days)} روز گذشته`}
      >
        {buckets.map((item, index) => (
          <div className="bos-chart-column" key={index}>
            <span className="bos-chart-bar-track">
              <span
                style={{ height: `${item.count ? Math.max(8, (item.count / max) * 100) : 0}%` }}
              />
            </span>
            <small>
              {days === 7 ? item.label.split(' ').slice(0, 2).join(' ') : formatNumber(index + 1)}
            </small>
          </div>
        ))}
      </div>
      {days === 30 && (
        <small className="bos-chart-note">هر ستون، بخشی از بازهٔ ۳۰ روزه را نشان می‌دهد.</small>
      )}
    </div>
  )
}

export function ActivityPanel({
  listings,
  inquiries,
  loading,
}: {
  listings: Listing[]
  inquiries: Inquiry[]
  loading: boolean
}) {
  const events = [
    ...listings
      .filter((item) => item.created_at)
      .map((item) => ({
        key: `listing-${item.id}`,
        title: `آگهی «${item.title}» ثبت شد`,
        date: item.created_at,
        icon: 'package' as BusinessIconName,
      })),
    ...inquiries.map((item) => ({
      key: `inquiry-${item.id}`,
      title: `درخواست جدید برای «${item.listing_title}»`,
      date: item.created_at,
      icon: 'inbox' as BusinessIconName,
    })),
  ]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 5)
  return (
    <section className="bos-panel bos-timeline-panel">
      <PanelHeading eyebrow="RECENT ACTIVITY" title="آخرین فعالیت‌ها" />
      {loading ? (
        <div className="bos-skeleton bos-row-skeleton" />
      ) : events.length ? (
        <ol className="bos-timeline">
          {events.map((item) => (
            <li key={item.key}>
              <span>
                <BusinessIcon name={item.icon} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>{formatShortDate(item.date)}</small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon="activity"
          title="فعالیتی ثبت نشده"
          description="آگهی‌ها و درخواست‌های این هویت اینجا نمایش داده می‌شوند."
        />
      )}
    </section>
  )
}
