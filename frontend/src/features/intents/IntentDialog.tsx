import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/features/home/icons'
import { ApiError, apiDelete, apiGet, apiPut } from '@/lib/api-client'
import { INTENT_GOALS, toggleIntentGoal, type IntentGoal, type IntentRecord } from './intent'
import './intent-dialog.css'

interface Props {
  open: boolean
  onClose: () => void
  userEmail: string
}

export function IntentDialog({ open, onClose, userEmail }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [selectedOverride, setSelectedOverride] = useState<IntentGoal[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [contactBusy, setContactBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const intent = useQuery({
    queryKey: ['user-intent', userEmail],
    queryFn: ({ signal }) => apiGet<IntentRecord>('/v1/intents/me', undefined, signal),
    enabled: open,
    retry: false,
  })
  const selected = selectedOverride ?? intent.data?.goals ?? []

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function handleClose() {
    setSelectedOverride(null)
    setError('')
    setSuccess(false)
    onClose()
  }

  async function save() {
    if (busy) return
    setBusy(true)
    setError('')
    setSuccess(false)
    try {
      const updated = await apiPut<IntentRecord>('/v1/intents/me/goals', { goals: selected })
      queryClient.setQueryData(['user-intent', userEmail], updated)
      setSelectedOverride(null)
      setSuccess(true)
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'ذخیره اهداف انجام نشد. دوباره تلاش کنید.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function removeContact() {
    if (contactBusy) return
    setContactBusy(true)
    setError('')
    try {
      const updated = await apiDelete<IntentRecord>('/v1/intents/me/contact')
      queryClient.setQueryData(['user-intent', userEmail], updated)
      setSuccess(true)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'حذف شماره تماس انجام نشد.')
    } finally {
      setContactBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="intent-dialog"
      dir="rtl"
      aria-labelledby="intent-dialog-title"
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close()
      }}
    >
      <div className="intent-dialog-body">
        <header className="intent-dialog-heading">
          <span className="intent-dialog-mark">
            <Icon name="compass" />
          </span>
          <div>
            <span className="intent-dialog-kicker">تنظیمات شخصی شما</span>
            <h2 id="intent-dialog-title">هدف من در کارفنسا</h2>
            <p>هدف‌هایتان را برای پیشنهادهای مرتبط‌تر به‌روز کنید.</p>
          </div>
          <button
            className="intent-dialog-close"
            type="button"
            aria-label="بستن"
            onClick={() => dialogRef.current?.close()}
          >
            <Icon name="x" />
          </button>
        </header>

        {intent.isPending ? (
          <div className="intent-dialog-loading" aria-busy="true">
            در حال دریافت هدف‌های شما…
          </div>
        ) : intent.isError ? (
          <div className="intent-dialog-error" role="alert">
            دریافت هدف‌ها ممکن نشد.
            <button type="button" onClick={() => intent.refetch()}>
              تلاش دوباره
            </button>
          </div>
        ) : (
          <>
            <p className="intent-dialog-help">
              می‌توانید چند هدف انتخاب کنید. «برای آشنایی و بررسی آمده‌ام» با هدف‌های تجاری ترکیب
              نمی‌شود.
            </p>
            <div className="intent-dialog-options" role="group" aria-label="هدف‌های من">
              {INTENT_GOALS.map((item) => (
                <label
                  key={item.id}
                  className={`intent-dialog-option${selected.includes(item.id) ? ' is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => {
                      setSelectedOverride(toggleIntentGoal(selected, item.id))
                      setSuccess(false)
                      setError('')
                    }}
                  />
                  <span className="intent-dialog-option-icon">
                    <Icon name={item.icon} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="intent-dialog-tick" aria-hidden="true">
                    <Icon name="badge-check" />
                  </span>
                </label>
              ))}
            </div>
            <p className="intent-dialog-note">
              این انتخاب‌ها فقط برای شخصی‌سازی هستند و نوع حساب یا دسترسی‌های شما را تغییر نمی‌دهند.
            </p>
            {intent.data?.contact_phone && (
              <div className="intent-dialog-contact">
                <div>
                  <strong>شماره تماس اختیاری</strong>
                  <span dir="ltr">{intent.data.contact_phone}</span>
                  <small>
                    {intent.data.contact_consent
                      ? 'رضایت تماس درباره فرصت‌های مرتبط ثبت شده است.'
                      : 'رضایت تماس ثبت نشده است.'}
                  </small>
                </div>
                <button type="button" disabled={contactBusy} onClick={removeContact}>
                  {contactBusy ? 'در حال حذف…' : 'حذف شماره و لغو رضایت'}
                </button>
              </div>
            )}
            {error && (
              <p className="intent-dialog-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="intent-dialog-success" role="status">
                <Icon name="badge-check" /> هدف‌های شما ذخیره شد.
              </p>
            )}
            <div className="intent-dialog-actions">
              <button
                type="button"
                className="intent-dialog-secondary"
                onClick={() => dialogRef.current?.close()}
              >
                بستن
              </button>
              <button
                type="button"
                className="intent-dialog-primary"
                disabled={busy}
                onClick={save}
              >
                {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
