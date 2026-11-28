import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, Building2, Clock3, LayoutDashboard, ShieldCheck, Users } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { dashboardApi } from '@/api/dashboard'
import { Card, EmptyState, ErrorState, Loading } from '@/components/ui'
import { formatDate, numberFormat } from '@/lib/format'
import { useResources } from '@/layouts/ControlLayout'

const DashboardCharts = lazy(() => import('./DashboardCharts'))
const metricIcons = [Users, Building2, ShieldCheck, LayoutDashboard, Activity, Clock3]

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const days = [7, 30, 90, 365].includes(Number(searchParams.get('days'))) ? Number(searchParams.get('days')) : 30
  const query = useQuery({ queryKey: ['dashboard', days], queryFn: ({ signal }) => dashboardApi.get(days, signal), staleTime: 60_000 })
  const resources = useResources()
  const quick = resources.data?.filter((item) => (item.permissions?.view ?? item.can_view ?? true) && (item.actions?.length || item.permissions?.create)).slice(0, 4) ?? []

  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">مرکز فرمان کارفنسا</div><h1>نمای کلی پلتفرم</h1><p>شاخص‌های واقعی عملیات و فعالیت‌های مدیریتی</p></div><div className="period-tabs" role="group" aria-label="بازه زمانی">{[7, 30, 90, 365].map((value) => <button key={value} className={days === value ? 'active' : ''} onClick={() => setSearchParams({ days: String(value) })}>{value === 365 ? 'یک سال' : `${numberFormat.format(value)} روز`}</button>)}</div></div>
    {query.isPending ? <div className="metrics-grid">{Array.from({ length: 8 }, (_, index) => <div className="metric-skeleton" key={index} />)}</div> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <>
      <div className="metrics-grid">{query.data.metrics.map((metric, index) => { const Icon = metricIcons[index % metricIcons.length]; return <Card className="metric-card" key={metric.key}><div className="metric-top"><span>{metric.label}</span><Icon size={19} /></div><strong>{metric.value == null ? 'در دسترس نیست' : numberFormat.format(metric.value)}</strong></Card> })}</div>
      {query.data.metrics.length === 0 && <EmptyState title="شاخصی برای این بازه ثبت نشده است" />}
      <div className="dashboard-mid"><Card className="activity-card"><div className="section-head"><h2>آخرین فعالیت‌های مدیریتی</h2><Clock3 size={18} /></div>{query.data.recent_activities?.length ? <div className="activity-list">{query.data.recent_activities.map((item) => <div key={item.id} className="activity-row"><span className="activity-dot" /><div><strong>{item.action}</strong><small>{item.actor}{item.target ? ` · ${item.target}` : ''}</small></div><time>{formatDate(item.created_at)}</time></div>)}</div> : <EmptyState title="فعالیتی در این بازه ثبت نشده است" />}</Card>
        <Card className="quick-card"><div className="section-head"><h2>دسترسی سریع</h2><Activity size={18} /></div>{quick.length ? <div className="quick-links">{quick.map((item) => <Link key={item.slug} to={`/resources/${item.slug}`}><span className="quick-icon">{item.title.slice(0, 1)}</span><span>{item.title}</span><ArrowLeft size={17} /></Link>)}</div> : <EmptyState title="بخش مجازی برای دسترسی سریع وجود ندارد" />}</Card></div>
      <Suspense fallback={<Loading label="در حال بارگذاری نمودارها…" />}><DashboardCharts charts={query.data.charts} /></Suspense>
    </>}
  </div>
}
