import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartPoint } from '@/api/types'
import { Card, EmptyState } from '@/components/ui'
import { numberFormat } from '@/lib/format'

const colors = ['#14243a', '#c99a3b', '#58738f', '#a77930', '#8ea3b8', '#d8ba80']

const definitions: Array<{ key: string; title: string; type: 'line' | 'bar' }> = [
  { key: 'registration_growth', title: 'روند ثبت‌نام کاربران', type: 'line' },
  { key: 'company_growth', title: 'روند ثبت شرکت‌ها', type: 'line' },
  { key: 'opportunity_distribution', title: 'توزیع فرصت‌های تجاری', type: 'bar' },
  { key: 'province_activity', title: 'فعالیت کسب‌وکار استان‌ها', type: 'bar' },
  { key: 'category_distribution', title: 'دسته‌بندی محصولات و خدمات', type: 'bar' },
  { key: 'moderation', title: 'وضعیت بررسی و انتشار', type: 'bar' },
  { key: 'inquiry_trends', title: 'روند استعلام‌ها', type: 'line' },
  { key: 'intent_distribution', title: 'هدف کاربران از ثبت‌نام', type: 'bar' },
]

export default function DashboardCharts({ charts }: { charts: Record<string, ChartPoint[]> }) {
  return <div className="chart-grid">{definitions.map(({ key, title, type }) => {
    const data = charts[key] ?? []
    const labelKey = type === 'line' ? 'date' : 'label'
    const valueKey = data.some((point) => typeof point.count === 'number') ? 'count' : 'value'
    return <Card key={key} className="chart-card"><div className="section-head"><h2>{title}</h2><span>{numberFormat.format(data.length)} مورد</span></div>{data.length === 0 ? <EmptyState title="داده‌ای برای این بازه وجود ندارد" /> : <div className="chart-canvas" role="img" aria-label={title}><ResponsiveContainer width="100%" height="100%">{type === 'line' ? <LineChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}><CartesianGrid vertical={false} stroke="#e9edf3" /><XAxis dataKey={labelKey} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={24} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} /><Tooltip formatter={(value) => numberFormat.format(Number(value))} /><Line type="monotone" dataKey={valueKey} stroke="#c99a3b" strokeWidth={2.6} dot={false} activeDot={{ r: 5 }} /></LineChart> : <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}><CartesianGrid vertical={false} stroke="#e9edf3" /><XAxis dataKey={labelKey} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} angle={data.length > 6 ? -35 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 65 : 30} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} /><Tooltip formatter={(value) => numberFormat.format(Number(value))} /><Bar dataKey={valueKey} radius={[5, 5, 0, 0]} maxBarSize={42}>{data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Bar></BarChart>}</ResponsiveContainer></div>}</Card>
  })}</div>
}
