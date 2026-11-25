import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { ManagementStatusBadge } from '@/components/management/ManagementLayout'
import { ApiError, apiGet, apiPost, apiPostForm } from '@/lib/api-client'
import { formatNumber, formatShortDate } from '@/lib/format'
import { BusinessIcon } from './BusinessIcons'
import './business-verification-mobile.css'

type VerificationDocument = {
  id: number
  document_type: string
  review_status: string
  rejection_reason: string
  created_at: string
}
type StatusTone = 'info' | 'success' | 'warning' | 'danger'

const documentTypes: Record<string, string> = {
  identity: 'مدرک هویتی',
  national_id: 'شناسه ملی',
  registration: 'آگهی ثبت',
  tax: 'مدرک مالیاتی',
  representative: 'معرفی‌نامه نماینده',
  other: 'مدرک تکمیلی',
}

const documentStatus: Record<string, string> = {
  pending: 'در انتظار بررسی',
  approved: 'تأییدشده',
  rejected: 'نیازمند اصلاح',
}

const verificationCopy: Record<string, { label: string; detail: string; tone: StatusTone }> = {
  draft: {
    label: 'پیش‌نویس',
    detail: 'اطلاعات هویت را تکمیل کنید و سپس برای بررسی بفرستید.',
    tone: 'info',
  },
  pending_review: {
    label: 'در حال بررسی',
    detail: 'درخواست شما ثبت شده است. نتیجه پس از بررسی در همین صفحه نمایش داده می‌شود.',
    tone: 'warning',
  },
  verified: {
    label: 'تأییدشده',
    detail: 'هویت کسب‌وکار شما تأیید شده است.',
    tone: 'success',
  },
  approved: {
    label: 'تأییدشده',
    detail: 'هویت کسب‌وکار شما تأیید شده است.',
    tone: 'success',
  },
  rejected: {
    label: 'نیازمند اصلاح',
    detail: 'موارد اعلام‌شده را اصلاح کنید و درخواست را دوباره بفرستید.',
    tone: 'danger',
  },
  suspended: {
    label: 'تعلیق‌شده',
    detail: 'این هویت تعلیق شده و با ارسال دوباره فعال نمی‌شود.',
    tone: 'danger',
  },
}

const documentTone = (status: string): StatusTone =>
  status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'

function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'ارتباط با سرویس برقرار نشد.'
}

export function BusinessVerificationPanel({
  kind,
  id,
  canSubmit,
  verificationStatus,
  rejectionReason,
  completion,
  profileReady,
  onEditProfile,
}: {
  kind: string
  id: string
  canSubmit: boolean
  verificationStatus: string
  rejectionReason: string
  completion: number | null
  profileReady: boolean
  onEditProfile: () => void
}) {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [documentType, setDocumentType] = useState(
    kind === 'organization' ? 'registration' : 'identity',
  )
  const [file, setFile] = useState<File | null>(null)
  const [documentError, setDocumentError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [notice, setNotice] = useState('')
  const documents = useQuery({
    queryKey: ['business', 'documents', kind, id],
    queryFn: ({ signal }) =>
      apiGet<VerificationDocument[]>('/v1/business/documents', { kind, identity_id: id }, signal),
  })
  const upload = useMutation({
    mutationFn: (body: FormData) =>
      apiPostForm<VerificationDocument>('/v1/business/documents', body),
    onSuccess: async () => {
      setDocumentError('')
      setNotice('مدرک با موفقیت بارگذاری شد.')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['business', 'documents', kind, id] })
    },
    onError: (cause) => setDocumentError(messageFrom(cause)),
  })
  const submit = useMutation({
    mutationFn: () =>
      apiPost(
        kind === 'organization'
          ? `/v1/business/organizations/${id}/submit`
          : '/v1/business/individual/submit',
        {},
      ),
    onSuccess: async () => {
      setSubmitError('')
      setNotice('درخواست بررسی با موفقیت ثبت شد.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['business', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['business', 'identities'] }),
      ])
    },
    onError: (cause) => setSubmitError(messageFrom(cause)),
  })
  const state: { label: string; detail: string; tone: StatusTone } = verificationCopy[
    verificationStatus
  ] ?? {
    label: 'وضعیت نامشخص',
    detail: 'وضعیت بررسی در دسترس نیست.',
    tone: 'info',
  }
  const statusLabel = verificationStatus === 'draft' && !profileReady ? 'اطلاعات ناقص' : state.label
  const availableTypes =
    kind === 'organization'
      ? Object.entries(documentTypes)
      : Object.entries(documentTypes).filter(([value]) =>
          ['identity', 'national_id', 'other'].includes(value),
        )
  const orderedDocuments = [...(documents.data ?? [])].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  )
  const canSend = canSubmit && ['draft', 'rejected'].includes(verificationStatus)
  const needsProfileSetup = canSend && !profileReady
  const showPermissionHint = !canSubmit && ['draft', 'rejected'].includes(verificationStatus)

  const uploadDocument = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return
    setDocumentError('')
    const body = new FormData()
    body.set('kind', kind)
    body.set('identity_id', id)
    body.set('document_type', documentType)
    body.set('upload', file)
    upload.mutate(body)
  }

  const apiBase = String(import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

  return (
    <section className="bos-panel bvm-panel">
      <div className={`bvm-status-card is-${state.tone}`}>
        <span className="bvm-status-icon">
          <BusinessIcon
            name={
              state.tone === 'success' ? 'check' : state.tone === 'danger' ? 'warning' : 'shield'
            }
          />
        </span>
        <div className="bvm-status-content">
          <div className="bvm-status-heading">
            <strong>وضعیت هویت</strong>
            <ManagementStatusBadge tone={state.tone}>{statusLabel}</ManagementStatusBadge>
          </div>
          <p>{state.detail}</p>
          <div className="bvm-progress-line">
            <span>تکمیل پروفایل</span>
            <strong>{completion === null ? '—' : `${formatNumber(completion)}٪`}</strong>
          </div>
          <div className="bvm-progress" aria-hidden="true">
            <span style={{ width: `${completion ?? 0}%` }} />
          </div>
        </div>
      </div>

      {rejectionReason && (
        <div className="bvm-rejection" role="note">
          <BusinessIcon name="warning" />
          <div>
            <strong>دلیل اصلاح</strong>
            <p>{rejectionReason}</p>
          </div>
        </div>
      )}
      {verificationStatus === 'suspended' && (
        <p className="bvm-suspended" role="note">
          برای پیگیری تعلیق با پشتیبانی کارفنسا در ارتباط باشید.
        </p>
      )}
      {notice && (
        <p className="bvm-notice" role="status">
          {notice}
        </p>
      )}

      <div className="bvm-documents-section">
        <div className="bvm-section-heading">
          <div>
            <h2>مدارک پشتیبان</h2>
            <p>افزودن مدرک اختیاری است؛ فایل‌ها فقط برای بررسی هویت استفاده می‌شوند.</p>
          </div>
          <span className="bvm-count">{formatNumber(orderedDocuments.length)} مدرک</span>
        </div>

        {documents.isLoading ? (
          <p className="bvm-loading" aria-live="polite">
            در حال دریافت مدارک…
          </p>
        ) : documents.isError ? (
          <div className="bvm-load-error" role="alert">
            <span>دریافت مدارک انجام نشد.</span>
            <button type="button" onClick={() => void documents.refetch()}>
              تلاش دوباره
            </button>
          </div>
        ) : orderedDocuments.length ? (
          <ul className="bvm-document-list">
            {orderedDocuments.map((item) => (
              <li className="bvm-document-card" key={item.id}>
                <span className="bvm-document-icon">
                  <BusinessIcon name="document" />
                </span>
                <div className="bvm-document-content">
                  <strong>{documentTypes[item.document_type] ?? item.document_type}</strong>
                  <span>{formatShortDate(item.created_at)}</span>
                  {item.rejection_reason && (
                    <p className="bvm-document-reason">{item.rejection_reason}</p>
                  )}
                </div>
                <div className="bvm-document-actions">
                  <ManagementStatusBadge tone={documentTone(item.review_status)}>
                    {documentStatus[item.review_status] ?? item.review_status}
                  </ManagementStatusBadge>
                  <a
                    href={`${apiBase}/v1/business/documents/${item.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`دریافت ${documentTypes[item.document_type] ?? 'مدرک'}`}
                  >
                    <BusinessIcon name="external" />
                    <span>دریافت فایل</span>
                  </a>
                </div>
              </li>
            ))}
            {availableTypes
              .filter(([value]) => !orderedDocuments.some((item) => item.document_type === value))
              .map(([value, label]) => (
                <li className="bvm-document-card is-empty" key={value}>
                  <span className="bvm-document-icon">
                    <BusinessIcon name="document" />
                  </span>
                  <div className="bvm-document-content">
                    <strong>{label}</strong>
                    <span>هنوز بارگذاری نشده</span>
                  </div>
                  <ManagementStatusBadge tone="neutral">بدون فایل</ManagementStatusBadge>
                </li>
              ))}
          </ul>
        ) : (
          <div className="bvm-empty">
            <BusinessIcon name="document" />
            <span>هنوز مدرکی بارگذاری نشده است.</span>
          </div>
        )}

        {canSubmit && (
          <form className="bvm-upload-form" onSubmit={uploadDocument}>
            <div className="bvm-upload-heading">
              <strong>
                {orderedDocuments.some(
                  (item) =>
                    item.document_type === documentType && item.review_status === 'rejected',
                )
                  ? 'ارسال نسخه اصلاح‌شده'
                  : 'افزودن مدرک'}
              </strong>
              <span>PDF، JPG، PNG یا WebP · حداکثر ۵ مگابایت</span>
            </div>
            <label>
              نوع مدرک
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
              >
                {availableTypes.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="bvm-file-field">
              <span>انتخاب فایل</span>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  setFile(event.currentTarget.files?.[0] ?? null)
                  setDocumentError('')
                }}
              />
            </label>
            {file && (
              <span className="bvm-file-name" dir="auto">
                <BusinessIcon name="document" />
                {file.name}
              </span>
            )}
            {documentError && (
              <p className="bvm-error" role="alert">
                {documentError}
              </p>
            )}
            <button type="submit" disabled={!file || upload.isPending}>
              <BusinessIcon name="plus" />
              {upload.isPending ? 'در حال بارگذاری…' : 'بارگذاری مدرک'}
            </button>
          </form>
        )}
      </div>

      {(canSend || needsProfileSetup || showPermissionHint || submitError) && (
        <div className="bvm-submit-area">
          {needsProfileSetup && (
            <p className="bvm-completion-hint">
              برای ارسال درخواست، اطلاعات ضروری پروفایل را کامل کنید.
              <button type="button" onClick={onEditProfile}>
                ویرایش پروفایل
              </button>
            </p>
          )}
          {submitError && (
            <p className="bvm-error" role="alert">
              {submitError}
            </p>
          )}
          {canSend && (
            <button
              className="bvm-submit"
              type="button"
              disabled={!profileReady || submit.isPending}
              onClick={() => submit.mutate()}
            >
              <BusinessIcon name="shield" />
              {submit.isPending
                ? 'در حال ارسال…'
                : verificationStatus === 'rejected'
                  ? 'ارسال دوباره برای بررسی'
                  : 'ارسال برای بررسی'}
            </button>
          )}
          {showPermissionHint && (
            <p className="bvm-permission-hint">
              برای بارگذاری مدرک یا ارسال درخواست، دسترسی لازم را ندارید.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
