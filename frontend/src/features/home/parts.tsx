import type { ReactNode } from 'react'
import { formatNumber } from '@/lib/format'
import { Icon } from './icons'

export interface TabItem<K extends string> {
  key: K
  label: string
  count?: number
}

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  label: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === value}
          className={'tab' + (t.key === value ? ' on' : '')}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null && <em>{formatNumber(t.count)}</em>}
        </button>
      ))}
    </div>
  )
}

export function SectionHead({
  icon,
  title,
  sub,
  children,
}: {
  icon: string
  title: string
  sub?: string
  children?: ReactNode
}) {
  return (
    <div className="sec-top">
      <div className="titles">
        <div className="panel-head">
          <span className="bar" />
          <Icon name={icon} className="ico" />
          <h2>{title}</h2>
        </div>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="side">{children}</div>}
    </div>
  )
}

export function Skeleton({
  height = 120,
  className = '',
}: {
  height?: number
  className?: string
}) {
  return <div className={`skel ${className}`.trim()} style={{ height }} aria-hidden="true" />
}

export function ErrorBox({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="errbox" role="alert">
      <span>دریافت اطلاعات انجام نشد.</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          تلاش دوباره
        </button>
      )}
    </div>
  )
}
