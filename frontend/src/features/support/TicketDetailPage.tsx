import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/features/home/icons'
import { useAuth } from '@/features/auth/useAuth'
import { apiGet, apiPost, apiPostForm } from '@/lib/api-client'
import { formatShortDate, formatClock } from '@/lib/format'
import type { TicketDetail } from './types'
import './support.css'

export function TicketDetailPage() {
  const { ticketNumber = '' } = useParams()
  const { data: user } = useAuth()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const ticket = useQuery({
    queryKey: ['support-ticket', ticketNumber],
    queryFn: ({ signal }) =>
      apiGet<TicketDetail>(`/v1/support/tickets/${ticketNumber}/`, undefined, signal),
    enabled: Boolean(user && ticketNumber),
  })

  const reply = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.set('message', message.trim() || 'پیوست')
      if (file) form.set('attachment', file)
      return apiPostForm<TicketDetail>(`/v1/support/tickets/${ticketNumber}/messages/`, form)
    },
    onSuccess: async (detail) => {
      setMessage('')
      setFile(null)
      queryClient.setQueryData(['support-ticket', ticketNumber], detail)
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
    },
  })

  const closeTicket = useMutation({
    mutationFn: () => apiPost<TicketDetail>(`/v1/support/tickets/${ticketNumber}/close/`, {}),
    onSuccess: async (detail) => {
      queryClient.setQueryData(['support-ticket', ticketNumber], detail)
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
    },
  })

  const data = ticket.data

  return (
    <section className="support-page" dir="rtl">
      <Link className="support-btn-ghost" to="/account/support">
        <Icon name="arrow-l" /> بازگشت به مرکز پشتیبانی
      </Link>
      {ticket.isPending && (
        <div className="support-card" style={{ minHeight: 200, marginTop: 16 }} />
      )}
      {ticket.isError && (
        <p className="support-error" role="alert">
          این تیکت پیدا نشد یا دسترسی به آن مجاز نیست.
        </p>
      )}
      {data && (
        <>
          <header className="support-hero" style={{ marginTop: 16 }}>
            <div>
              <span className="support-kicker">{data.ticket_number}</span>
              <h1>{data.subject}</h1>
              <p>
                {data.category_display} · ثبت {formatShortDate(data.created_at)}
              </p>
            </div>
            <span className={`support-badge is-${data.status}`}>{data.status_display}</span>
          </header>

          {data.is_closed && (
            <p className="support-closed" role="status">
              این تیکت بسته شده است و امکان ارسال پاسخ تازه وجود ندارد.
            </p>
          )}

          <div className="support-thread">
            {data.messages.map((item) => (
              <article key={item.id} className={`support-bubble is-${item.sender_type}`}>
                <header>
                  <strong>
                    {item.sender_type === 'staff' && <span className="support-avatar">ک</span>}{' '}
                    {item.sender_label}
                  </strong>
                  <time>
                    {formatShortDate(item.created_at)}، {formatClock(item.created_at)}
                  </time>
                </header>
                <p>{item.message}</p>
                {item.attachment_url && (
                  <a className="support-attachment" href={item.attachment_url}>
                    دانلود پیوست{item.attachment_name ? ` (${item.attachment_name})` : ''}
                  </a>
                )}
              </article>
            ))}
          </div>

          {!data.is_closed && (
            <form
              className="support-composer"
              onSubmit={(event: FormEvent) => {
                event.preventDefault()
                if (!message.trim() && !file) return
                reply.mutate()
              }}
            >
              <h2>ارسال پاسخ</h2>
              <label className="support-field support-wide">
                پیام شما
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
              </label>
              <label className="support-field">
                پیوست
                <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </label>
              {reply.isError && (
                <p className="support-error" role="alert">
                  {reply.error instanceof Error ? reply.error.message : 'ارسال پاسخ انجام نشد.'}
                </p>
              )}
              <div className="support-actions">
                <button className="support-btn" type="submit" disabled={reply.isPending}>
                  {reply.isPending ? 'در حال ارسال…' : 'ارسال پاسخ'}
                </button>
                <button
                  className="support-btn-ghost"
                  type="button"
                  onClick={() => closeTicket.mutate()}
                  disabled={closeTicket.isPending}
                >
                  بستن تیکت
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}
