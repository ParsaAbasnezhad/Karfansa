import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '@/features/home/icons'
import { apiGet, apiPost, apiPostForm } from '@/lib/api-client'
import { formatClock, formatShortDate } from '@/lib/format'
import type { TicketDetail } from './types'
import './support.css'

export function GuestTrackPage() {
  const [params, setParams] = useSearchParams()
  const [ticketNumber, setTicketNumber] = useState(params.get('ticket') ?? '')
  const [token, setToken] = useState(params.get('token') ?? '')
  const enabled = Boolean(params.get('ticket') && params.get('token'))

  const ticket = useQuery({
    queryKey: ['guest-ticket', params.get('ticket'), params.get('token')],
    queryFn: ({ signal }) =>
      apiGet<TicketDetail>(
        `/v1/support/tickets/${params.get('ticket')}/`,
        { access_token: params.get('token') ?? '' },
        signal,
      ),
    enabled,
    retry: false,
  })

  const reply = useMutation({
    mutationFn: async (message: string) => {
      const form = new FormData()
      form.set('message', message)
      form.set('access_token', params.get('token') ?? '')
      return apiPostForm<TicketDetail>(
        `/v1/support/tickets/${params.get('ticket')}/messages/?access_token=${encodeURIComponent(params.get('token') ?? '')}`,
        form,
      )
    },
  })

  const closeTicket = useMutation({
    mutationFn: () =>
      apiPost<TicketDetail>(
        `/v1/support/tickets/${params.get('ticket')}/close/?access_token=${encodeURIComponent(params.get('token') ?? '')}`,
        {},
      ),
  })

  const data = reply.data ?? closeTicket.data ?? ticket.data

  const lookup = (event: FormEvent) => {
    event.preventDefault()
    setParams({ ticket: ticketNumber.trim(), token: token.trim() })
  }

  return (
    <section className="support-page" dir="rtl">
      <header className="support-hero">
        <div>
          <span className="support-kicker">
            <Icon name="search" /> پیگیری مهمان
          </span>
          <h1>پیگیری درخواست پشتیبانی</h1>
          <p>
            شماره تیکت و کد پیگیری را وارد کنید. این کد فقط هنگام ثبت درخواست نمایش داده می‌شود.
          </p>
        </div>
      </header>

      <form className="support-composer" onSubmit={lookup}>
        <div className="support-grid">
          <label className="support-field">
            شماره تیکت
            <input
              value={ticketNumber}
              onChange={(event) => setTicketNumber(event.target.value)}
              required
            />
          </label>
          <label className="support-field">
            کد پیگیری
            <input value={token} onChange={(event) => setToken(event.target.value)} required />
          </label>
        </div>
        <div className="support-actions">
          <button className="support-btn" type="submit">
            مشاهده تیکت
          </button>
        </div>
      </form>

      {ticket.isError && (
        <p className="support-error" role="alert">
          تیکت پیدا نشد. شماره و کد پیگیری را بررسی کنید.
        </p>
      )}

      {data && (
        <>
          <header className="support-hero">
            <div>
              <span className="support-kicker">{data.ticket_number}</span>
              <h1>{data.subject}</h1>
            </div>
            <span className={`support-badge is-${data.status}`}>{data.status_display}</span>
          </header>
          <div className="support-thread">
            {data.messages.map((item) => (
              <article key={item.id} className={`support-bubble is-${item.sender_type}`}>
                <header>
                  <strong>{item.sender_label}</strong>
                  <time>
                    {formatShortDate(item.created_at)}، {formatClock(item.created_at)}
                  </time>
                </header>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
          {!data.is_closed && (
            <GuestReply
              pending={reply.isPending}
              onReply={(text) => reply.mutate(text)}
              onClose={() => closeTicket.mutate()}
            />
          )}
        </>
      )}
    </section>
  )
}

function GuestReply({
  pending,
  onReply,
  onClose,
}: {
  pending: boolean
  onReply: (message: string) => void
  onClose: () => void
}) {
  const [message, setMessage] = useState('')
  return (
    <form
      className="support-composer"
      onSubmit={(event) => {
        event.preventDefault()
        if (message.trim().length < 2) return
        onReply(message.trim())
        setMessage('')
      }}
    >
      <label className="support-field support-wide">
        پاسخ شما
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <div className="support-actions">
        <button className="support-btn" type="submit" disabled={pending}>
          ارسال پاسخ
        </button>
        <button className="support-btn-ghost" type="button" onClick={onClose}>
          بستن تیکت
        </button>
      </div>
    </form>
  )
}
