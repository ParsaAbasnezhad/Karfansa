import { useQuery } from '@tanstack/react-query'
import { Activity, Database, Radio, Server, Workflow } from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import { Card, ErrorState, Loading } from '@/components/ui'
import { formatDate, numberFormat } from '@/lib/format'

const components: Array<{ key: 'database' | 'redis' | 'celery_workers' | 'celery_beat'; title: string; icon: typeof Database }> = [
  { key: 'database', title: 'پایگاه داده', icon: Database },
  { key: 'redis', title: 'ردیس', icon: Radio },
  { key: 'celery_workers', title: 'پردازشگر وظایف', icon: Workflow },
  { key: 'celery_beat', title: 'زمان‌بند وظایف', icon: Activity },
]

export default function HealthPage() {
  const query = useQuery({ queryKey: ['system-health'], queryFn: ({ signal }) => dashboardApi.health(signal), refetchInterval: 60_000 })

  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">عملیات</div><h1>وضعیت سامانه</h1><p>بررسی محدود و بدون افشای پیکربندی حساس</p></div></div>
    {query.isPending ? <Loading label="در حال دریافت وضعیت…" /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <>
      <div className="metrics-grid">{components.map(({ key, title, icon: Icon }) => {
        const item = query.data[key]
        return <Card className="metric-card" key={key}><div className="metric-top"><span>{title}</span><Icon size={19} /></div><strong className={`health-status is-${item?.status ?? 'unknown'}`}>{item?.status ?? 'unknown'}</strong>{item?.detail && <small>{item.detail}</small>}</Card>
      })}</div>
      <Card className="activity-card"><div className="section-head"><h2>شاخص‌های عملیاتی</h2><Server size={18} /></div>
        <dl className="health-facts">
          <div><dt>زمان بررسی</dt><dd>{formatDate(query.data.checked_at)}</dd></div>
          <div><dt>حجم پایگاه داده</dt><dd>{query.data.database_bytes == null ? '—' : `${numberFormat.format(query.data.database_bytes)} بایت`}</dd></div>
          <div><dt>فضای ذخیره‌سازی</dt><dd>{query.data.storage_used_bytes == null || query.data.storage_total_bytes == null ? '—' : `${numberFormat.format(query.data.storage_used_bytes)} / ${numberFormat.format(query.data.storage_total_bytes)}`}</dd></div>
          <div><dt>وظایف موفق ۲۴ساعت</dt><dd>{query.data.completed_tasks_24h ?? '—'}</dd></div>
          <div><dt>وظایف ناموفق ۲۴ساعت</dt><dd>{query.data.failed_tasks_24h ?? '—'}</dd></div>
          <div><dt>تأخیر API (p95)</dt><dd>{query.data.api_p95_ms ?? '—'}</dd></div>
        </dl>
      </Card>
    </>}
  </div>
}
