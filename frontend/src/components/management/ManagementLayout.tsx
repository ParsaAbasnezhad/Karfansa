import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { Icon, type IconName } from '@/features/home/icons'
import { NotificationBell } from '@/features/inquiries/NotificationBell'
import './management.css'

const sections: { to: string; label: string; shortLabel: string; icon: IconName }[] = [
  { to: '/account', label: 'پروفایل کاربری', shortLabel: 'پروفایل', icon: 'user' },
  { to: '/business', label: 'مدیریت کسب‌وکار', shortLabel: 'کسب‌وکار', icon: 'building' },
  { to: '/account/inquiries', label: 'مدیریت درخواست‌ها', shortLabel: 'درخواست‌ها', icon: 'mail' },
]

export function ManagementLayout() {
  const { pathname } = useLocation()
  const { data: user } = useAuth()
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
  const initial = displayName[0] || 'ک'

  return (
    <div className="management-shell" dir="rtl">
      <header className="management-header">
        <div className="management-header-inner">
          <Link className="management-brand" to="/account" aria-label="کارفنسا، محیط مدیریت">
            <img src="/KARFANSA%20%E2%80%94%20Logo.svg" alt="" />
            <span className="management-brand-copy">
              <strong>کارفنسا</strong>
              <small>محیط مدیریت</small>
            </span>
          </Link>
          <div className="management-header-actions">
            <NotificationBell enabled={Boolean(user)} />
            <Link className="management-site-link" to="/" aria-label="بازگشت به سایت">
              <Icon name="arrow-l" />
              <span>بازگشت به سایت</span>
            </Link>
            <span
              className="management-avatar"
              title={displayName || 'حساب کاربری'}
              aria-label={displayName || 'حساب کاربری'}
            >
              {initial}
            </span>
          </div>
        </div>
        <nav className="management-nav" aria-label="بخش‌های مدیریت">
          <div className="management-nav-inner">
            {sections.map(({ to, label, shortLabel, icon }) => {
              const active = pathname.replace(/\/$/, '') === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`management-nav-link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon name={icon} />
                  <span className="management-nav-label">{label}</span>
                  <span className="management-nav-short" aria-hidden="true">
                    {shortLabel}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </header>
      <main className="management-main management-content" id="content">
        <Outlet />
      </main>
    </div>
  )
}

export function ManagementPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`management-page-header ${className}`.trim()}>
      <div className="management-page-heading">
        {eyebrow && <span className="management-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="management-page-actions">{actions}</div>}
    </div>
  )
}

type ManagementButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  to?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
}

export function ManagementButton({
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  title,
  'aria-label': ariaLabel,
  ...buttonProps
}: ManagementButtonProps) {
  const classes = `management-button is-${variant} is-${size} ${className}`.trim()
  if (to) {
    return (
      <Link className={classes} to={to} title={title} aria-label={ariaLabel}>
        {children}
      </Link>
    )
  }
  return (
    <button className={classes} title={title} aria-label={ariaLabel} {...buttonProps}>
      {children}
    </button>
  )
}

export function ManagementCard({
  as: Component = 'section',
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div'
  children: ReactNode
}) {
  return (
    <Component className={`management-card ${className}`.trim()} {...props}>
      {children}
    </Component>
  )
}

export function ManagementStatusBadge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  className?: string
  children: ReactNode
}) {
  return <span className={`management-status is-${tone} ${className}`.trim()}>{children}</span>
}

export function ManagementTable({
  className = '',
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="management-table-wrap">
      <table className={`management-table ${className}`.trim()} {...props}>
        {children}
      </table>
    </div>
  )
}

export function ManagementFilterBar({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`management-filters ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

export function ManagementField({
  label,
  hint,
  error,
  className = '',
  children,
}: {
  label: string
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`management-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="management-field-error">{error}</small>}
    </label>
  )
}
