import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/features/home/icons'
import { formatNumber, formatShortDate } from '@/lib/format'
import type { ProductListing } from '@/features/services/types'
import type { TradeOpportunity, TradeOpportunityType } from '@/features/trade/types'
import { TradeTypeIcon } from '@/features/trade/TradeArt'
import { VerifiedBadge } from './shared'
import './detail.css'

export type QuickFact = {
  label: string
  value: string
}

export type SectionTab = {
  id: string
  label: string
}

export function DetailPageSkeleton() {
  return (
    <div className="kd-skel" aria-hidden="true">
      <div className="kd-skel-hero" />
      <div className="kd-skel-row">
        <div className="kd-skel-block" />
        <div className="kd-skel-block" />
        <div className="kd-skel-block" />
        <div className="kd-skel-block" />
      </div>
      <div className="kd-skel-main" />
    </div>
  )
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  const share = useCallback(async () => {
    const url = window.location.href
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url })
        return
      }
    } catch {
      /* user cancelled or share failed — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [title])

  return (
    <button
      type="button"
      className={`kd-share${copied ? ' is-copied' : ''}`}
      onClick={() => void share()}
      aria-label={copied ? 'لینک کپی شد' : 'اشتراک‌گذاری'}
    >
      <Icon name={copied ? 'copy' : 'share'} />
      {copied ? 'کپی شد' : 'اشتراک‌گذاری'}
    </button>
  )
}

export function ProfileQuickFacts({ items }: { items: QuickFact[] }) {
  const visible = items.filter((item) => item.value.trim())
  if (!visible.length) return null
  return (
    <div className="kd-facts" aria-label="اطلاعات کلیدی">
      {visible.map((item) => (
        <div key={item.label} className="kd-fact">
          <strong>{item.label}</strong>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export function ProfileSectionTabs({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: SectionTab[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const listId = useId()
  return (
    <div className="kd-tabs-wrap">
      <div className="kd-tabs" role="tablist" aria-label="بخش‌های صفحه" id={listId}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeId === tab.id}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function useSectionNavigation(sectionIds: string[]) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? '')
  const scrollingRef = useRef(false)

  useEffect(() => {
    if (!sectionIds.length) return
    const nodes = sectionIds
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node))
    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (top?.target.id) setActiveId(top.target.id)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [sectionIds])

  const scrollTo = useCallback((id: string) => {
    const node = document.getElementById(id)
    if (!node) return
    setActiveId(id)
    scrollingRef.current = true
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    window.setTimeout(() => {
      scrollingRef.current = false
    }, 500)
  }, [])

  return { activeId, scrollTo }
}

export function ResponsiveSection({
  id,
  title,
  count,
  children,
  action,
}: {
  id: string
  title: string
  count?: number
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="kd-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="kd-section-head">
        <h2 id={`${id}-title`}>{title}</h2>
        {typeof count === 'number' && (
          <span className="kd-section-count">{formatNumber(count)} مورد</span>
        )}
        {action}
      </div>
      {children}
    </section>
  )
}

export function ProfileHero({
  variant = 'company',
  coverImage,
  markSrc,
  markLabel,
  chips,
  verified,
  title,
  subtitle,
  lead,
  place,
  actions,
}: {
  variant?: 'company' | 'person' | 'opportunity'
  coverImage?: string | null
  markSrc?: string | null
  markLabel: string
  chips?: ReactNode
  verified?: boolean
  title: string
  subtitle?: string | null
  lead?: string | null
  place?: string | null
  actions?: ReactNode
}) {
  const letter = markLabel.trim().slice(0, 1) || 'ک'
  return (
    <header className={`kd-hero kd-hero--${variant}`}>
      <div className="kd-hero-cover">
        {coverImage && <img src={coverImage} alt="" />}
      </div>
      <div className="kd-hero-body">
        <div className={`kd-hero-mark${variant === 'person' ? ' kd-hero-mark--person' : ''}`}>
          {markSrc ? <img src={markSrc} alt="" /> : letter}
        </div>
        <div className="kd-hero-copy">
          <div className="kd-hero-meta">
            {chips}
            <VerifiedBadge show={Boolean(verified)} />
          </div>
          <h1>{title}</h1>
          {subtitle && (
            <p className={`kd-hero-sub${variant === 'company' ? ' kd-hero-sub--latin' : ''}`}>
              {subtitle}
            </p>
          )}
          {place && (
            <p className="kd-hero-place">
              <Icon name="pin" />
              {place}
            </p>
          )}
          {lead && <p className="kd-hero-lead">{lead}</p>}
        </div>
        {actions && <div className="kd-hero-actions">{actions}</div>}
      </div>
    </header>
  )
}

export function BusinessContactCard({
  title = 'تماس و همکاری',
  note,
  website,
  address,
  place,
  verified,
  socials,
  primaryAction,
  secondaryAction,
}: {
  title?: string
  note?: string
  website?: string | null
  address?: string | null
  place?: string | null
  verified?: boolean
  socials?: Array<{ href: string; label: string; icon: 'linkedin' | 'instagram' | 'whatsapp' | 'send' }>
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
}) {
  const hasContact = Boolean(website || address || place || (socials && socials.length))
  return (
    <aside className="kd-card" aria-label={title}>
      <h2 className="kd-card-title">{title}</h2>
      {verified ? (
        <div className="kd-hero-meta">
          <VerifiedBadge show />
        </div>
      ) : null}
      {note && <p className="kd-card-note">{note}</p>}
      {hasContact && (
        <ul className="kd-contact-list">
          {place && (
            <li>
              <span>موقعیت</span>
              <strong>{place}</strong>
            </li>
          )}
          {address && (
            <li>
              <span>نشانی عمومی</span>
              <strong>{address}</strong>
            </li>
          )}
          {website && (
            <li>
              <span>وب‌سایت</span>
              <a href={website} target="_blank" rel="noreferrer">
                {website.replace(/^https?:\/\//, '')}
              </a>
            </li>
          )}
        </ul>
      )}
      {socials && socials.length > 0 && (
        <div className="kd-socials" aria-label="شبکه‌های اجتماعی">
          {socials.map((item) => (
            <a key={item.href} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label}>
              <Icon name={item.icon} />
            </a>
          ))}
        </div>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="kd-card-actions">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </aside>
  )
}

function truncate(text: string, max = 90) {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

export function ProductMiniCard({ item }: { item: ProductListing }) {
  const image = item.images[0]
  return (
    <Link className="kd-mini-card" to={`/services/listings/${encodeURIComponent(item.slug)}`}>
      <div className="kd-mini-media">
        {image ? (
          <img src={image.url} alt={image.alt_text || item.title} loading="lazy" />
        ) : (
          <span aria-hidden="true">بدون تصویر</span>
        )}
      </div>
      <div className="kd-mini-body">
        <div className="kd-mini-meta">
          <span className="kd-chip kd-chip--blue">{item.category_name}</span>
        </div>
        <h3>{item.title}</h3>
        {item.description && <p>{truncate(item.description)}</p>}
      </div>
    </Link>
  )
}

export function ProductMiniGrid({ items }: { items: ProductListing[] }) {
  if (!items.length) return null
  return (
    <div className="kd-mini-grid">
      {items.map((item) => (
        <ProductMiniCard key={item.id} item={item} />
      ))}
    </div>
  )
}

export type OpportunityCardData = {
  id: number | string
  title: string
  slug: string
  opportunity_type_display: string
  opportunity_type?: TradeOpportunityType | string
  province_name_fa?: string | null
  description?: string | null
  valid_until?: string | null
}

export function OpportunityMiniCard({ item }: { item: OpportunityCardData }) {
  return (
    <Link className="kd-opp-card" to={`/trade/${encodeURIComponent(item.slug)}`}>
      <div className="kd-mini-meta">
        <span
          className={`kd-chip kd-chip--type-${item.opportunity_type ?? 'export'}`}
        >
          {item.opportunity_type_display}
        </span>
      </div>
      <h3>{item.title}</h3>
      {item.description && <p>{truncate(item.description, 110)}</p>}
      <div className="kd-opp-foot">
        {item.province_name_fa && <span>{item.province_name_fa}</span>}
        {item.valid_until && <span>اعتبار تا {formatShortDate(item.valid_until)}</span>}
      </div>
    </Link>
  )
}

export function OpportunityMiniGrid({ items }: { items: OpportunityCardData[] }) {
  if (!items.length) return null
  return (
    <div className="kd-mini-grid">
      {items.map((item) => (
        <OpportunityMiniCard key={item.id} item={item} />
      ))}
    </div>
  )
}

export function ProfileStats({
  items,
}: {
  items: Array<{ label: string; value: number }>
}) {
  if (!items.length) return null
  return (
    <div className="kd-stats" aria-label="آمار">
      {items.map((item) => (
        <div key={item.label} className="kd-stat">
          <strong>{formatNumber(item.value)}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function opportunityTypeChipClass(type: TradeOpportunityType | string) {
  return `kd-chip kd-chip--type-${type}`
}

export function isOpportunityActive(
  item: Partial<Pick<TradeOpportunity, 'is_published' | 'review_status' | 'valid_until'>>,
) {
  if (item.valid_until) {
    const end = new Date(item.valid_until)
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) return false
  }
  if (item.is_published === false) return false
  if (item.review_status && item.review_status !== 'approved') return false
  return true
}

export function OpportunityStatusBadge({
  active,
}: {
  active: boolean
}) {
  return (
    <span className={`kd-status ${active ? 'kd-status--active' : 'kd-status--expired'}`}>
      <span className="kd-status-dot" aria-hidden="true" />
      {active ? 'فعال' : 'غیرفعال / منقضی'}
    </span>
  )
}

export function OpportunitySummary({ items }: { items: QuickFact[] }) {
  const visible = items.filter((item) => item.value.trim())
  if (!visible.length) return null
  return (
    <div className="kd-summary" aria-label="خلاصه فرصت">
      {visible.map((item) => (
        <div key={item.label} className="kd-summary-item">
          <strong>{item.label}</strong>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export function OpportunityActionCard({
  active,
  validUntil,
  primaryHref,
  primaryLabel,
  primaryDisabledReason,
  publisherHref,
  publisherLabel,
}: {
  active: boolean
  validUntil?: string | null
  primaryHref?: string | null
  primaryLabel: string
  primaryDisabledReason?: string
  publisherHref?: string | null
  publisherLabel?: string
}) {
  return (
    <aside className="kd-card" aria-label="اقدامات فرصت">
      <h2 className="kd-card-title">اقدام بعدی</h2>
      <OpportunityStatusBadge active={active} />
      {validUntil && (
        <ul className="kd-contact-list">
          <li>
            <span>مهلت اعتبار</span>
            <strong>
              <time dateTime={validUntil}>{formatShortDate(validUntil)}</time>
            </strong>
          </li>
        </ul>
      )}
      {!active && (
        <p className="kd-card-note">
          این فرصت در حال حاضر برای ارسال درخواست همکاری در دسترس نیست.
        </p>
      )}
      {active && primaryDisabledReason && !primaryHref && (
        <p className="kd-card-note">{primaryDisabledReason}</p>
      )}
      <div className="kd-card-actions">
        {active && primaryHref ? (
          <Link className="dir-button" to={primaryHref}>
            {primaryLabel}
          </Link>
        ) : (
          <button className="dir-button" type="button" disabled>
            {primaryLabel}
          </button>
        )}
        {publisherHref && publisherLabel && (
          <Link className="dir-button is-ghost" to={publisherHref}>
            {publisherLabel}
          </Link>
        )}
      </div>
    </aside>
  )
}

export function OpportunityTypePill({
  type,
  label,
  style,
}: {
  type: TradeOpportunityType
  label: string
  style?: CSSProperties
}) {
  return (
    <span className={`kd-type-pill ${opportunityTypeChipClass(type)}`} style={style}>
      <TradeTypeIcon type={type} />
      {label}
    </span>
  )
}

export function PublisherCard({
  name,
  href,
  markSrc,
  meta,
  verified,
}: {
  name: string
  href: string
  markSrc?: string | null
  meta: string
  verified?: boolean
}) {
  return (
    <Link className="kd-publisher" to={href}>
      <span className="kd-publisher-mark">
        {markSrc ? <img src={markSrc} alt="" /> : name.slice(0, 1)}
      </span>
      <span>
        <strong>{name}</strong>
        <span>
          {meta}
          {verified ? ' · تأییدشده' : ''}
        </span>
      </span>
    </Link>
  )
}

export function useDocumentTitle(title: string | undefined, fallback: string) {
  useEffect(() => {
    document.title = title ? `${title} | کارفنسا` : fallback
  }, [title, fallback])
}

export function joinPlace(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join('، ')
}

export function firstAvailableListing(...pages: Array<{ results: ProductListing[] } | undefined>) {
  for (const page of pages) {
    const first = page?.results[0]
    if (first) return first
  }
  return undefined
}

export function buildSocialLinks(input: {
  linkedin?: string
  instagram?: string
  telegram?: string
  whatsapp?: string
}) {
  const items: Array<{ href: string; label: string; icon: 'linkedin' | 'instagram' | 'whatsapp' | 'send' }> = []
  if (input.linkedin) items.push({ href: input.linkedin, label: 'لینکدین', icon: 'linkedin' })
  if (input.instagram) items.push({ href: input.instagram, label: 'اینستاگرام', icon: 'instagram' })
  if (input.whatsapp) {
    const digits = input.whatsapp.replace(/[^\d]/g, '')
    items.push({
      href: digits ? `https://wa.me/${digits}` : input.whatsapp,
      label: 'واتساپ',
      icon: 'whatsapp',
    })
  }
  if (input.telegram) {
    const handle = input.telegram.replace(/^@/, '')
    const href = handle.startsWith('http') ? handle : `https://t.me/${handle}`
    items.push({ href, label: 'تلگرام', icon: 'send' })
  }
  return items
}

export function DetailFactsList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>
}) {
  const visible = items.filter((item) => {
    if (item.value === null || item.value === undefined || item.value === false) return false
    if (typeof item.value === 'string') return item.value.trim().length > 0
    return true
  })
  if (!visible.length) return null
  return (
    <dl className="kd-detail-grid">
      {visible.map((item) => (
        <div key={item.label} className="kd-detail-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

