import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '@/features/home/icons'
import { useAuth } from '@/features/auth/useAuth'
import { apiGet, apiPatch, apiPost, type ApiError } from '@/lib/api-client'
import { formatClock, formatNumber, formatShortDate } from '@/lib/format'
import './inquiries.css'

export type Inquiry = {
  public_id: string
  target_type: 'trade' | 'product' | 'service'
  target_title: string
  target_url: string
  owner_name: string
  applicant_name: string
  category: string
  subject: string
  message: string
  status: string
  status_display: string
  created_at: string
  last_activity_at: string
  unread: boolean
}
type Detail = Inquiry & {
  viewer_role: 'owner' | 'applicant'
  messages: { sender_name: string; sender_role: string; body: string; created_at: string }[]
  status_events: { from_status: string; to_status: string; actor_name: string; created_at: string }[]
}
type Page = {
  results: Inquiry[]
  count: number
  page: number
  page_size: number
  total_pages: number
  summary: Record<'total' | 'new' | 'reviewing' | 'accepted' | 'rejected', number>
}

const categoryNames: Record<string, string> = {
  purchase: 'خرید و سفارش', partnership: 'همکاری تجاری', investment: 'سرمایه‌گذاری',
  supply: 'تأمین و عرضه', other: 'سایر',
}
const targetNames = { trade: 'فرصت تجاری', product: 'محصول', service: 'خدمت' }
const metrics = [
  ['total', 'کل درخواست‌ها'], ['new', 'جدید'], ['reviewing', 'در حال بررسی'],
  ['accepted', 'پذیرفته‌شده'], ['rejected', 'ردشده'],
] as const

function errorText(error: unknown) {
  return (error as ApiError)?.message || 'دریافت اطلاعات انجام نشد. دوباره تلاش کنید.'
}

export function InquiryDashboardPage() {
  const { data: user, isPending: authPending } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'submitted' ? 'submitted' : 'received'
  const selected = params.get('id') || ''
  const [status, setStatus] = useState('')
  const [targetType, setTargetType] = useState('')
  const [ordering, setOrdering] = useState('newest')
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [mobileFilters, setMobileFilters] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 320)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const list = useQuery({
    queryKey: ['inquiries', tab, status, targetType, ordering, search, page],
    queryFn: ({ signal }) => apiGet<Page>(`/v1/inquiries/${tab}`, {
      status, target_type: targetType, ordering, search, page, page_size: 20,
    }, signal),
    enabled: Boolean(user),
  })
  const detail = useQuery({
    queryKey: ['inquiry-detail', selected],
    queryFn: ({ signal }) => apiGet<Detail>(`/v1/inquiries/${selected}`, undefined, signal),
    enabled: Boolean(user && selected),
  })
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inquiries'] }),
      queryClient.invalidateQueries({ queryKey: ['inquiry-detail', selected] }),
      queryClient.invalidateQueries({ queryKey: ['inquiry-notifications'] }),
    ])
  }
  const statusMutation = useMutation({
    mutationFn: (value: string) => apiPatch<Detail>(`/v1/inquiries/${selected}/status`, { status: value }),
    onSuccess: refresh,
  })
  const replyMutation = useMutation({
    mutationFn: (body: string) => apiPost<Detail>(`/v1/inquiries/${selected}/messages`, { body }),
    onSuccess: () => { setMessage(''); void refresh() },
  })

  function selectTab(next: 'received' | 'submitted') {
    setParams({ tab: next })
    setStatus(''); setTargetType(''); setPage(1); setSearchInput('')
  }
  function selectInquiry(id: string) { setParams({ tab, id }) }
  function closeDetail() { setParams({ tab }) }
  function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (message.trim().length >= 2 && !replyMutation.isPending) replyMutation.mutate(message.trim())
  }

  if (authPending) return <section className="iq-workspace" dir="rtl"><p>در حال بررسی حساب…</p></section>
  if (!user) return <section className="iq-workspace iq-guard" dir="rtl"><h1>درخواست‌های همکاری</h1><p>برای دیدن درخواست‌ها وارد حساب شوید.</p><Link className="iq-button is-primary management-button" to="/login" state={{ returnTo: '/account/inquiries' }}>ورود به حساب</Link></section>

  return (
    <div className="iq-workspace" dir="rtl">
      <header className="iq-page-header management-page-header">
        <div><span className="iq-eyebrow">مرکز ارتباطات</span><h1>درخواست‌های همکاری</h1><p>درخواست‌های دریافتی و ارسالی و گفت‌وگوهای مرتبط را پیگیری کنید.</p></div>
      </header>
      <div className="iq-tabs" role="tablist" aria-label="نوع درخواست">
        <button role="tab" aria-selected={tab === 'received'} className={tab === 'received' ? 'is-active' : ''} onClick={() => selectTab('received')}>درخواست‌های دریافتی</button>
        <button role="tab" aria-selected={tab === 'submitted'} className={tab === 'submitted' ? 'is-active' : ''} onClick={() => selectTab('submitted')}>درخواست‌های ارسالی</button>
      </div>
      <div className="iq-metrics">{metrics.map(([key, label]) => <div className={`iq-metric management-card is-${key}`} key={key}><span>{label}</span><strong>{list.data ? formatNumber(list.data.summary[key]) : '—'}</strong></div>)}</div>
      <section className="iq-main-grid">
        <div className="iq-list-panel management-card">
          <div className="iq-list-head"><div><h2>{tab === 'received' ? 'درخواست‌های دریافتی' : 'درخواست‌های ارسالی'}</h2></div><button className="iq-filter-toggle management-button" type="button" aria-expanded={mobileFilters} onClick={() => setMobileFilters((value) => !value)}><Icon name="sliders" /> فیلترها</button></div>
          <div className={`iq-filters${mobileFilters ? ' is-open' : ''}`}>
            <label className="iq-search"><span className="sr-only">جست‌وجو</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="جست‌وجو در موضوع، آگهی یا متقاضی…" /></label>
            <label><span className="sr-only">وضعیت</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">همه وضعیت‌ها</option><option value="new">جدید</option><option value="reviewing">در حال بررسی</option><option value="accepted">پذیرفته‌شده</option><option value="rejected">ردشده</option></select></label>
            <label><span className="sr-only">نوع آگهی</span><select value={targetType} onChange={(event) => { setTargetType(event.target.value); setPage(1) }}><option value="">همه موارد</option><option value="trade">فرصت تجاری</option><option value="product">محصول</option><option value="service">خدمت</option></select></label>
            <label><span className="sr-only">ترتیب</span><select value={ordering} onChange={(event) => setOrdering(event.target.value)}><option value="newest">تازه‌ترین</option><option value="oldest">قدیمی‌ترین</option></select></label>
          </div>
          {list.isPending ? <p className="iq-list-state">در حال دریافت درخواست‌ها…</p> : list.isError ? <div className="iq-list-state" role="alert">{errorText(list.error)} <button type="button" onClick={() => void list.refetch()}>تلاش دوباره</button></div> : list.data.results.length === 0 ? <p className="iq-list-state">درخواستی با این فیلترها پیدا نشد.</p> : (
            <div className="iq-rows">{list.data.results.map((item) => <button key={item.public_id} type="button" className={`iq-row${selected === item.public_id ? ' is-selected' : ''}`} onClick={() => selectInquiry(item.public_id)}>
              <span className="iq-row-avatar" aria-hidden="true">{(tab === 'received' ? item.applicant_name : item.owner_name).slice(0, 1)}</span>
              <span className="iq-row-copy"><span className="iq-row-top"><strong>{tab === 'received' ? item.applicant_name : item.owner_name}</strong>{item.unread && <i className="iq-unread" title="خوانده‌نشده" />}<time dateTime={item.created_at}>{formatShortDate(item.created_at)}</time></span><b>{item.subject}</b><span>{targetNames[item.target_type]} · {item.target_title} · {categoryNames[item.category] || item.category}</span><small>{item.message}</small></span>
              <span className={`iq-status management-badge is-${item.status}`}>{item.status_display}</span>
            </button>)}</div>
          )}
          {list.data && list.data.total_pages > 1 && <div className="iq-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>صفحه قبل</button><span>صفحه {formatNumber(page)} از {formatNumber(list.data.total_pages)}</span><button disabled={page >= list.data.total_pages} onClick={() => setPage(page + 1)}>صفحه بعد</button></div>}
        </div>
        <aside className={`iq-detail-panel management-card${selected ? ' is-open' : ''}`} aria-label="جزئیات درخواست">
          {selected ? <>
            <button className="iq-detail-back" onClick={closeDetail}><Icon name="arrow-l" /> بازگشت به فهرست</button>
            {detail.isPending ? <p className="iq-list-state">در حال دریافت جزئیات…</p> : detail.isError ? <p className="iq-list-state" role="alert">{errorText(detail.error)}</p> : detail.data && <>
              <div className="iq-detail-head"><span className="iq-eyebrow">پرونده همکاری</span><h2>{detail.data.subject}</h2><span className={`iq-status management-badge is-${detail.data.status}`}>{detail.data.status_display}</span></div>
              <Link className="iq-target-link" to={detail.data.target_url}><span>{targetNames[detail.data.target_type]}</span><strong>{detail.data.target_title}</strong><small>مشاهده آگهی <Icon name="arrow-l" /></small></Link>
              <dl className="iq-detail-facts"><div><dt>متقاضی</dt><dd>{detail.data.applicant_name}</dd></div><div><dt>منتشرکننده</dt><dd>{detail.data.owner_name}</dd></div><div><dt>نوع درخواست</dt><dd>{categoryNames[detail.data.category] || detail.data.category}</dd></div><div><dt>ثبت‌شده در</dt><dd>{formatShortDate(detail.data.created_at)} · {formatClock(detail.data.created_at)}</dd></div></dl>
              <section className="iq-detail-section"><h3>شرح درخواست</h3><p>{detail.data.message}</p></section>
              {detail.data.viewer_role === 'owner' && !['accepted', 'rejected', 'closed'].includes(detail.data.status) && <div className="iq-status-actions"><h3>مدیریت وضعیت</h3>{['reviewing', 'accepted', 'rejected'].filter((value) => value !== detail.data.status).map((value) => <button key={value} disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(value)}>{value === 'reviewing' ? 'در حال بررسی' : value === 'accepted' ? 'پذیرش' : 'رد درخواست'}</button>)}{statusMutation.isError && <p role="alert">{errorText(statusMutation.error)}</p>}</div>}
              <section className="iq-detail-section"><h3>گفت‌وگو</h3>{detail.data.messages.length ? <div className="iq-thread">{detail.data.messages.map((item, index) => <article className={`iq-message is-${item.sender_role}`} key={`${item.created_at}-${index}`}><div><strong>{item.sender_name}</strong><time dateTime={item.created_at}>{formatShortDate(item.created_at)} · {formatClock(item.created_at)}</time></div><p>{item.body}</p></article>)}</div> : <p className="iq-thread-empty">هنوز پاسخی ثبت نشده است.</p>}
                {!['rejected', 'closed'].includes(detail.data.status) && <form onSubmit={sendReply} className="iq-reply"><label htmlFor="iq-reply-body">پیام تازه</label><textarea id="iq-reply-body" value={message} onChange={(event) => setMessage(event.target.value)} minLength={2} maxLength={4000} rows={4} placeholder="پاسخ خود را بنویسید…" required /><button className="iq-button is-primary management-button" disabled={replyMutation.isPending || message.trim().length < 2}>{replyMutation.isPending ? 'در حال ارسال…' : 'ارسال پاسخ'}</button>{replyMutation.isError && <p role="alert">{errorText(replyMutation.error)}</p>}</form>}
              </section>
              {detail.data.status_events.length > 0 && <section className="iq-detail-section"><h3>تاریخچه وضعیت</h3><ol className="iq-timeline">{detail.data.status_events.map((event, index) => <li key={`${event.created_at}-${index}`}><b>{event.to_status === 'reviewing' ? 'در حال بررسی' : event.to_status === 'accepted' ? 'پذیرفته‌شده' : 'ردشده'}</b><small>{event.actor_name} · {formatShortDate(event.created_at)} · {formatClock(event.created_at)}</small></li>)}</ol></section>}
            </>}
          </> : <div className="iq-detail-placeholder"><span aria-hidden="true"><Icon name="mail" /></span><h2>پرونده‌ها، در یک نگاه</h2><p>برای دیدن شرح درخواست، پاسخ‌ها و روند بررسی، یک مورد را انتخاب کنید.</p></div>}
        </aside>
      </section>
    </div>
  )
}
