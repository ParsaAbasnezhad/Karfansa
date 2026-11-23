import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiGet } from '@/lib/api-client'
import { formatClock, formatShortDate } from '@/lib/format'
import './notification-bell.css'

type Notification = {
  id: number
  public_id: string
  kind: string
  title: string
  target_title: string
  created_at: string
  read: boolean
}

export function NotificationBell({ enabled }: { enabled: boolean }) {
  const query = useQuery({
    queryKey: ['inquiry-notifications'],
    queryFn: ({ signal }) => apiGet<{ results: Notification[]; unread_count: number }>(
      '/v1/inquiries/notifications/list', undefined, signal,
    ),
    enabled,
    staleTime: 60_000,
    retry: false,
  })
  if (!enabled) return null
  return <details className="iq-bell">
    <summary aria-label={`اعلان‌ها${query.data?.unread_count ? `، ${query.data.unread_count} خوانده‌نشده` : ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8ZM10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {Boolean(query.data?.unread_count) && <i>{query.data?.unread_count}</i>}
    </summary>
    <div className="iq-bell-popover" dir="rtl">
      <div className="iq-bell-heading"><strong>اعلان‌ها</strong><Link to="/account/inquiries">همه درخواست‌ها</Link></div>
      {query.isPending ? <p>در حال دریافت اعلان‌ها…</p> : query.isError ? <p>اعلان‌ها در دسترس نیستند.</p> : query.data?.results.length ? query.data.results.map((item) => <Link key={item.id} to={`/account/inquiries?tab=${item.kind === 'new' || item.kind === 'applicant_reply' ? 'received' : 'submitted'}&id=${item.public_id}`} className={item.read ? '' : 'is-unread'}>
        <strong>{item.title}</strong><span>{item.target_title}</span><time dateTime={item.created_at}>{formatShortDate(item.created_at)} · {formatClock(item.created_at)}</time>
      </Link>) : <p>اعلان تازه‌ای ندارید.</p>}
    </div>
  </details>
}
