import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { apiGet, apiPost, type ApiError } from '@/lib/api-client'
import './inquiries.css'

type TargetType = 'trade' | 'product' | 'service'
type Contact = { owner_name: string; channels: { label: string; href: string }[] }
type Draft = { category: string; subject: string; message: string }

function savedDraft(key: string): Draft | null {
  try {
    const saved = sessionStorage.getItem(key)
    return saved ? JSON.parse(saved) as Draft : null
  } catch { return null }
}

const categories = [
  ['purchase', 'خرید و سفارش'], ['partnership', 'همکاری تجاری'],
  ['investment', 'سرمایه‌گذاری'], ['supply', 'تأمین و عرضه'], ['other', 'سایر'],
] as const

export function InquiryActions({ targetType, slug, title, ownerName }: {
  targetType: TargetType
  slug: string
  title: string
  ownerName: string
}) {
  const { data: user, isPending: authPending } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const storageKey = `karfansa-inquiry-draft:${targetType}:${slug}`
  const stored = useMemo(() => savedDraft(storageKey), [storageKey])
  const [open, setOpen] = useState(Boolean(stored))
  const [contactOpen, setContactOpen] = useState(false)
  const [contact, setContact] = useState<Contact | null>(null)
  const [contactLoading, setContactLoading] = useState(false)
  const [contactError, setContactError] = useState('')
  const [draft, setDraft] = useState<Draft>(stored || { category: 'partnership', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const key = useRef<string | null>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const closeModal = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    subjectRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) closeModal()
      if (event.key !== 'Tab') return
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, sending, closeModal])

  function change(next: Draft) {
    setDraft(next)
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* optional */ }
  }

  function begin() {
    if (authPending) return
    if (!user) {
      try { sessionStorage.setItem(storageKey, JSON.stringify(draft)) } catch { /* optional */ }
      navigate('/login', {
        state: {
          backgroundLocation: location,
          returnTo: `${location.pathname}${location.search}`,
        },
      })
      return
    }
    setSent(false)
    setOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setSending(true)
    setError('')
    key.current ??= crypto.randomUUID()
    try {
      await apiPost('/v1/inquiries/', {
        target_type: targetType,
        target_slug: slug,
        category: draft.category,
        subject: draft.subject.trim(),
        message: draft.message.trim(),
        client_key: key.current,
      })
      setSent(true)
      try { sessionStorage.removeItem(storageKey) } catch { /* optional */ }
    } catch (cause) {
      setError((cause as ApiError)?.message || 'ثبت درخواست انجام نشد. دوباره تلاش کنید.')
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  async function showContact() {
    setContactOpen(true)
    setContactLoading(true)
    setContactError('')
    try {
      const data = await apiGet<Contact>(
        `/v1/inquiries/contact/${targetType}/${encodeURIComponent(slug)}`,
      )
      setContact(data)
    } catch (cause) {
      setContactError((cause as ApiError)?.message || 'اطلاعات تماس در دسترس نیست.')
    } finally {
      setContactLoading(false)
    }
  }

  return (
    <section className="iq-action-card" aria-label="راه‌های ارتباط با منتشرکننده" dir="rtl">
      <span className="iq-eyebrow">شروع یک همکاری تازه</span>
      <h2>گفت‌وگو را از همین‌جا آغاز کنید</h2>
      <p>درخواست خود را امن و مستقیم برای {ownerName} بفرستید و روند آن را در کارفنسا دنبال کنید.</p>
      <div className="iq-action-buttons">
        <button ref={triggerRef} type="button" className="iq-button is-primary" onClick={begin} disabled={authPending}>
          <span aria-hidden="true">↗</span> درخواست همکاری
        </button>
        <button type="button" className="iq-button is-outline" onClick={showContact}>
          ارتباط مستقیم
        </button>
      </div>
      {contactOpen && (
        <div className="iq-contact-panel">
          <div className="iq-inline-head"><strong>راه‌های ارتباط عمومی</strong><button type="button" onClick={() => setContactOpen(false)} aria-label="بستن راه‌های تماس">×</button></div>
          {contactLoading ? <p>در حال دریافت راه‌های تماس…</p> : contactError ? <p role="alert">{contactError}</p> : contact?.channels.length ? (
            <div className="iq-contact-links">{contact.channels.map((channel) => (
              <a key={channel.href} href={channel.href} target={channel.href.startsWith('https:') ? '_blank' : undefined} rel={channel.href.startsWith('https:') ? 'noopener noreferrer' : undefined}>
                {channel.label}<span aria-hidden="true">↗</span>
              </a>
            ))}</div>
          ) : <p>راه تماس عمومی برای این منتشرکننده ثبت نشده است.</p>}
        </div>
      )}
      {open && (
        <div className="iq-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) closeModal() }}>
          <div ref={modalRef} className="iq-modal" role="dialog" aria-modal="true" aria-labelledby="iq-modal-title" dir="rtl">
            <div className="iq-modal-top">
              <div><span className="iq-eyebrow">فرم همکاری کارفنسا</span><h2 id="iq-modal-title">درخواست همکاری</h2></div>
              <button type="button" className="iq-close" onClick={closeModal} aria-label="بستن" disabled={sending}>×</button>
            </div>
            <div className="iq-target-summary"><span>مربوط به</span><strong>{title}</strong><small>منتشرکننده: {ownerName}</small></div>
            {sent ? (
              <div className="iq-success" role="status"><span aria-hidden="true">✓</span><h3>درخواست شما ثبت شد</h3><p>پاسخ و وضعیت آن را در بخش درخواست‌های ارسالی دنبال کنید.</p><a href="/account/inquiries?tab=submitted" className="iq-button is-primary">پیگیری درخواست</a></div>
            ) : (
              <form className="iq-form" onSubmit={submit}>
                <label>نوع درخواست<select value={draft.category} onChange={(event) => change({ ...draft, category: event.target.value })}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>موضوع<input ref={subjectRef} value={draft.subject} onChange={(event) => change({ ...draft, subject: event.target.value })} minLength={3} maxLength={180} required placeholder="موضوع درخواست خود را بنویسید" /></label>
                <label>شرح درخواست<textarea value={draft.message} onChange={(event) => change({ ...draft, message: event.target.value })} minLength={10} maxLength={2000} required rows={6} placeholder="هدف، ظرفیت و جزئیات همکاری را توضیح دهید" /></label>
                {error && <p className="iq-error" role="alert">{error}</p>}
                <button className="iq-button is-primary" disabled={sending}>{sending ? 'در حال ثبت…' : 'ثبت و ارسال درخواست'}</button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
