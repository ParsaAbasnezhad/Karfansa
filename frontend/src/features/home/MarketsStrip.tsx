import { AppLink } from '@/components/AppLink'
import { formatChange, formatNumber } from '@/lib/format'
import { URLS } from '@/lib/site'
import { useMarkets } from './data'
import { Icon } from './icons'
import { ErrorBox, Skeleton } from './parts'

function Sparkline({ data, down }: { data?: number[]; down: boolean }) {
  if (!data || data.length < 2) return <span className="spark" />
  const w = 78
  const h = 34
  const min = Math.min(...data)
  const max = Math.max(...data)
  const step = w / (data.length - 1)
  const pts = data.map(
    (v, i) => [i * step, h - 3 - ((v - min) / (max - min || 1)) * (h - 8)] as const,
  )
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')
  const last = pts[pts.length - 1]!
  const color = down ? 'var(--down)' : 'var(--up)'
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${line}L${w} ${h}L0 ${h}Z`} fill={color} fillOpacity=".14" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  )
}

/** Live-market panel: dollar, gold, TEDPIX, Brent. */
export function MarketsStrip() {
  const { data, isError, refetch } = useMarkets()
  if (isError && !data) return <ErrorBox onRetry={() => void refetch()} />
  if (!data) return <Skeleton height={400} />

  return (
    <aside className="panel market" aria-label="بازارهای مالی">
      <div className="panel-head">
        <span className="bar" />
        <Icon name="trend" className="ico" />
        <h2>بازارهای مالی</h2>
        <span className="live">
          <i />
          زنده
        </span>
      </div>
      <ul className="mk">
        {data.results.map((m) => (
          <li key={m.id}>
            <span className="ci">
              <Icon name={m.icon} />
            </span>
            <div className="nm">
              <b>{m.title}</b>
              <small>{m.subtitle}</small>
            </div>
            <Sparkline data={m.spark} down={m.change < 0} />
            <div className="val">
              <b>{formatNumber(m.value)}</b>
              <span className={'chg' + (m.change < 0 ? ' down' : '')}>
                {formatChange(m.change)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <AppLink className="more" href={URLS.markets}>
        <Icon name="arrow-l" />
        مشاهده کامل بازارها
      </AppLink>
    </aside>
  )
}
