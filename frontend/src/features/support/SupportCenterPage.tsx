import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { Icon } from '@/features/home/icons'
import { useAuth } from '@/features/auth/useAuth'
import { apiGet, apiPostForm, ApiError } from '@/lib/api-client'
import { formatShortDate } from '@/lib/format'
import { TICKET_CATEGORIES, emptySummary, type TicketPage, type TicketCreated } from './types'
import './support.css'

const statusFilters = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'open', label: 'باز' },
  { value: 'in_progress', label: 'در حال بررسی' },
  { value: 'waiting_for_user', label: 'در انتظار شما' },
  { value: 'answered', label: 'پاسخ داده‌شده' },
  { value: 'closed', label: 'بسته‌شده' },
]

export function SupportCenterPage() {
  const { data: user, isPending, isError, error } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [showForm, setShowForm] = useState(params.get('new') === '1')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '1') || 1

  const tickets = useQuery({
    queryKey: ['support-tickets', q, status, page],
    queryFn: ({ signal }) =>
      apiGet<TicketPage>('/v1/support/tickets/', { q, status, page, page_size: 8 }, signal),
    enabled: Boolean(user),
  })

  const createTicket = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.set('subject', subject.trim())
      form.set('category', category)
      form.set('message', message.trim())
      form.set('priority', 'normal')
      if (file) form.set('attachment', file)
      return apiPostForm<TicketCreated>('/v1/support/tickets/', form)
    },
    onSuccess: async () => {
      setSubject('')
      setCategory('')
      setMessage('')
      setFile(null)
      setShowForm(false)
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
    },
  })

  const summary = tickets.data?.summary ?? emptySummary
  const fieldError = useMemo(() => {
    if (subject.trim().length < 3) return 'موضوع باید حداقل ۳ نویسه باشد.'
    if (!TICKET_CATEGORIES.some((item) => item.value === category))
      return 'دسته‌بندی را انتخاب کنید.'
    if (message.trim().length < 10) return 'شرح درخواست باید حداقل ۱۰ نویسه باشد.'
    return ''
  }, [subject, category, message])

  if (isPending) {
    return (
      <section className="support-page" aria-label="در حال بارگذاری پشتیبانی">
        <div className="support-card" style={{ minHeight: 180 }} />
      </section>
    )
  }

  if (!user) {
    const signedOut = error instanceof ApiError && error.status === 401
    return (
      <section className="support-page">
        <div className="support-card">
          <h1>{signedOut ? 'برای دیدن پشتیبانی وارد شوید' : 'پشتیبانی در دسترس نیست'}</h1>
          <p className="support-muted">
            {signedOut
              ? 'پس از ورود می‌توانید درخواست‌های پشتیبانی را ببینید و تیکت تازه ثبت کنید.'
              : isError
                ? 'ارتباط با سرویس حساب برقرار نشد.'
                : 'اطلاعات حساب دریافت نشد.'}
          </p>
          {signedOut && (
            <AppLink className="support-btn" href="/login/">
              ورود به حساب
            </AppLink>
          )}
        </div>
      </section>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (fieldError) return
    createTicket.mutate()
  }

  return (
    <section className="support-page" dir="rtl">
      <header className="support-hero">
        <div>
          <span className="support-kicker">
            <Icon name="mail" /> مرکز پشتیبانی کارفنسا
          </span>
          <h1>درخواست‌های پشتیبانی شما</h1>
          <p>
            تیکت‌های خود را ثبت کنید، وضعیت را ببینید و پاسخ تیم پشتیبانی را همین‌جا دنبال کنید.
          </p>
        </div>
        <button
          type="button"
          className="support-btn"
          onClick={() => setShowForm((value) => !value)}
        >
          <Icon name="send" />
          {showForm ? 'بستن فرم' : 'تیکت جدید'}
        </button>
      </header>

      <div className="support-stats" aria-label="خلاصه تیکت‌ها">
        <article className="support-stat">
          <span>همه تیکت‌ها</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="support-stat">
          <span>باز</span>
          <strong>{summary.open}</strong>
        </article>
        <article className={`support-stat${summary.waiting_for_user ? ' is-alert' : ''}`}>
          <span>در انتظار شما</span>
          <strong>{summary.waiting_for_user}</strong>
        </article>
        <article className="support-stat">
          <span>پاسخ داده‌شده</span>
          <strong>{summary.answered}</strong>
        </article>
      </div>

      {showForm && (
        <form className="support-composer" onSubmit={submit} noValidate>
          <h2>ثبت درخواست تازه</h2>
          <div className="support-grid">
            <label className="support-field">
              موضوع
              <input
                value={subject}
                maxLength={180}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
            </label>
            <label className="support-field">
              دسته‌بندی
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
              >
                <option value="">انتخاب کنید</option>
                {TICKET_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="support-field support-wide">
              شرح درخواست
              <textarea
                value={message}
                maxLength={5000}
                onChange={(event) => setMessage(event.target.value)}
                required
              />
            </label>
            <label className="support-field support-wide">
              پیوست اختیاری
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {createTicket.isError && (
            <p className="support-error" role="alert">
              {createTicket.error instanceof Error
                ? createTicket.error.message
                : 'ثبت تیکت انجام نشد.'}
            </p>
          )}
          {createTicket.isSuccess && (
            <p className="support-success" role="status">
              {createTicket.data.message} شماره تیکت: {createTicket.data.ticket_number}
            </p>
          )}
          <div className="support-actions">
            <button
              className="support-btn"
              type="submit"
              disabled={createTicket.isPending || Boolean(fieldError)}
            >
              {createTicket.isPending ? 'در حال ارسال…' : 'ارسال درخواست'}
            </button>
          </div>
        </form>
      )}

      <div className="support-toolbar">
        <input
          defaultValue={q}
          placeholder="جستجو بر اساس موضوع یا شماره تیکت"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const next = new URLSearchParams(params)
              next.set('q', event.currentTarget.value)
              next.set('page', '1')
              setParams(next)
            }
          }}
        />
        <select
          value={status}
          onChange={(event) => {
            const next = new URLSearchParams(params)
            next.set('status', event.target.value)
            next.set('page', '1')
            setParams(next)
          }}
        >
          {statusFilters.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {tickets.isError && (
        <p className="support-error" role="alert">
          دریافت فهرست تیکت‌ها ممکن نشد.
        </p>
      )}

      {!tickets.data?.results.length && !tickets.isPending ? (
        <div className="support-empty">
          <Icon name="file" />
          <b>تیکتی ثبت نشده است</b>
          <small>برای شروع، درخواست پشتیبانی تازه‌ای بفرستید.</small>
          <button type="button" className="support-btn" onClick={() => setShowForm(true)}>
            ثبت تیکت جدید
          </button>
        </div>
      ) : (
        <div className="support-list">
          {(tickets.data?.results ?? []).map((ticket) => (
            <Link
              key={ticket.id}
              className="support-ticket"
              to={`/account/support/${ticket.ticket_number}`}
            >
              <div>
                <b>
                  {ticket.has_unread && (
                    <i className="support-unread" aria-label="پاسخ خوانده‌نشده" />
                  )}{' '}
                  {ticket.subject}
                </b>
                <div className="support-meta">
                  <span>{ticket.ticket_number}</span>
                  <span>{ticket.category_display}</span>
                  <span>{formatShortDate(ticket.created_at)}</span>
                  {ticket.last_message_at && (
                    <span>آخرین به‌روزرسانی: {formatShortDate(ticket.last_message_at)}</span>
                  )}
                </div>
              </div>
              <span className={`support-badge is-${ticket.status}`}>{ticket.status_display}</span>
            </Link>
          ))}
        </div>
      )}

      {(tickets.data?.total_pages ?? 0) > 1 && (
        <div className="support-pager">
          <button
            type="button"
            className="support-btn-ghost"
            disabled={page <= 1}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set('page', String(page - 1))
              setParams(next)
            }}
          >
            قبلی
          </button>
          <button
            type="button"
            className="support-btn-ghost"
            disabled={page >= (tickets.data?.total_pages ?? 1)}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set('page', String(page + 1))
              setParams(next)
            }}
          >
            بعدی
          </button>
        </div>
      )}
    </section>
  )
}
