import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowRight, Clock3, KeyRound, MessageSquare, Pencil, Send, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { resourceApi } from '@/api/resources'
import { authApi } from '@/api/auth'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Loading } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { InlinePanel } from '@/components/InlinePanel'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatValue } from '@/lib/format'
import { useResources } from '@/layouts/ControlLayout'

export default function ResourceDetailPage() {
  const { user } = useAuth()
  const mfaRequired = user?.mfa_required ?? true
  const { slug = '', id = '' } = useParams()
  const descriptors = useResources()
  const descriptor = descriptors.data?.find((item) => item.slug === slug)
  const query = useQuery({ queryKey: ['resource-detail', slug, id], queryFn: ({ signal }) => resourceApi.get(slug, id, signal), enabled: !!descriptor })
  const ticketMessages = useQuery({
    queryKey: ['ticket-messages', id],
    queryFn: ({ signal }) => resourceApi.ticketMessages(id, signal),
    enabled: slug === 'support.supportticket' && !!descriptor,
  })
  const queryClient = useQueryClient()
  const notify = useToast()
  const navigate = useNavigate()
  const [pending, setPending] = useState<{ key: string; label: string; tone?: string; requiresReason?: boolean } | null>(null)
  const [reason, setReason] = useState('')
  const mutation = useMutation({ mutationFn: async ({ key, reason }: { key: string; reason: string }) => key === 'delete' ? resourceApi.delete(slug, id) : resourceApi.action(slug, id, key, reason ? { reason } : {}), onSuccess: () => {
    notify('تغییر ثبت شد.'); setPending(null); setReason(''); void queryClient.invalidateQueries({ queryKey: ['resource', slug] }); void queryClient.invalidateQueries({ queryKey: ['resource-detail', slug, id] }); if (pending?.key === 'delete') navigate(`/resources/${slug}`)
  }, onError: (error) => notify(error instanceof Error ? error.message : 'عملیات انجام نشد.', 'error') })
  const upload = useMutation({
    mutationFn: ({ field, file }: { field: string; file: File }) => resourceApi.uploadFile(slug, id, field, file),
    onSuccess: () => {
      notify('فایل بارگذاری شد.')
      void queryClient.invalidateQueries({ queryKey: ['resource-detail', slug, id] })
      void queryClient.invalidateQueries({ queryKey: ['resource', slug] })
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'بارگذاری فایل انجام نشد.', 'error'),
  })
  const credential = useMutation({
    mutationFn: async ({ field, value, password, code }: { field: string; value: string; password: string; code: string }) => {
      await authApi.reauth(password, code)
      return resourceApi.rotateCredential(slug, id, field, value)
    },
    onSuccess: () => {
      notify('اعتبار دسترسی به‌روزرسانی شد. مقدار محرمانه دوباره نمایش داده نمی‌شود.')
      setCredentialDraft('')
      setReauthPassword('')
      setReauthCode('')
      setCredentialOpen(false)
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'به‌روزرسانی اعتبار انجام نشد.', 'error'),
  })
  const [credentialOpen, setCredentialOpen] = useState(false)
  const [credentialDraft, setCredentialDraft] = useState('')
  const [reauthPassword, setReauthPassword] = useState('')
  const [reauthCode, setReauthCode] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketInternal, setTicketInternal] = useState(false)
  const [ticketAttachment, setTicketAttachment] = useState<File | null>(null)
  const [ticketPassword, setTicketPassword] = useState('')
  const [ticketCode, setTicketCode] = useState('')
  const [ticketAttachmentBusy, setTicketAttachmentBusy] = useState<string | null>(null)
  const ticketReply = useMutation({
    mutationFn: async () => {
      await authApi.reauth(ticketPassword, ticketCode)
      return resourceApi.sendTicketMessage(id, ticketMessage, ticketInternal, ticketInternal ? null : ticketAttachment)
    },
    onSuccess: () => {
      notify(ticketInternal ? 'یادداشت داخلی ثبت شد.' : 'پاسخ برای کاربر ارسال شد.')
      setTicketMessage('')
      setTicketInternal(false)
      setTicketAttachment(null)
      setTicketPassword('')
      setTicketCode('')
      void queryClient.invalidateQueries({ queryKey: ['ticket-messages', id] })
      void queryClient.invalidateQueries({ queryKey: ['resource-detail', slug, id] })
      void queryClient.invalidateQueries({ queryKey: ['resource', slug] })
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'ثبت پیام انجام نشد.', 'error'),
  })
  const downloadTicketAttachment = async (messageId: string) => {
    setTicketAttachmentBusy(messageId)
    try {
      const blob = await resourceApi.ticketAttachment(id, messageId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ticket-${id}-attachment`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('پیوست دریافت شد.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'دریافت پیوست انجام نشد.', 'error')
    } finally {
      setTicketAttachmentBusy(null)
    }
  }

  if (descriptors.isPending || query.isPending) return <Loading />
  if (descriptors.isError) return <ErrorState error={descriptors.error} retry={() => void descriptors.refetch()} />
  if (!descriptor || !(descriptor.permissions?.view ?? descriptor.can_view ?? true)) return <EmptyState title="این پرونده در دسترس نیست" />
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  if (ticketMessages.isError) return <ErrorState error={ticketMessages.error} retry={() => void ticketMessages.refetch()} />
  const record = query.data
  return <div className="page-stack"><div className="page-heading"><div><Link className="back-link" to={`/resources/${slug}`}><ArrowRight size={17} /> بازگشت به {descriptor.title}</Link><h1>{descriptor.singular ?? descriptor.title} <span className="record-id">#{id}</span></h1><p>اطلاعات ثبت شده و عملیات مجاز پرونده</p></div><div className="heading-actions">{(descriptor.permissions?.update ?? descriptor.can_update) && <Link className="button button-secondary" to={`/resources/${slug}/${id}/edit`}><Pencil size={17} /> ویرایش</Link>}{(descriptor.permissions?.delete ?? descriptor.can_delete) && <Button variant="danger" onClick={() => setPending({ key: 'delete', label: 'حذف پرونده', tone: 'danger' })}><Trash2 size={17} /> حذف</Button>}</div></div>
    {descriptor.actions?.length ? <Card className="action-card"><div><strong>گردش‌کار مدیریتی</strong><p className="muted">تصمیم‌های این بخش در تاریخچه مدیریت ثبت می‌شوند.</p></div><div className="action-list">{descriptor.actions.map((action) => <Button key={action.key} variant={action.tone === 'danger' ? 'danger' : 'secondary'} onClick={() => setPending(action)}>{action.label}</Button>)}</div></Card> : null}
    {descriptor.fields.filter((field) => field.type === 'file').map((field) => <Card className="detail-card" key={field.name}><div className="section-head"><h2>{field.label}</h2><Upload size={18} /></div>{typeof record[field.name] === 'string' && <img className="record-image-preview" src={String(record[field.name])} alt={field.label} />}{(descriptor.permissions?.update ?? descriptor.can_update) && <label className="button button-secondary file-upload-control"><Upload size={17} /> بارگذاری فایل<input type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate({ field: field.name, file }); event.target.value = '' }} /></label>}</Card>)}
    {descriptor.write_only_fields?.map((field) => <Card className="detail-card" key={field.name}><div className="section-head"><h2>{field.label}</h2><KeyRound size={18} /></div><p className="muted">مقدار فعلی هرگز از سرور خوانده یا دوباره نمایش داده نمی‌شود.</p><Button variant="secondary" onClick={() => setCredentialOpen(true)}>به‌روزرسانی محرمانه</Button><ConfirmDialog open={credentialOpen} onOpenChange={setCredentialOpen} title={`به‌روزرسانی ${field.label}`} description={mfaRequired ? 'برای تغییر اعتبار، مقدار جدید و تأیید دوباره گذرواژه و کد دومرحله‌ای لازم است.' : 'برای تغییر اعتبار، مقدار جدید و تأیید دوباره گذرواژه لازم است.'} confirmLabel="ذخیره اعتبار جدید" onConfirm={() => credential.mutate({ field: field.name, value: credentialDraft, password: reauthPassword, code: reauthCode })} busy={credential.isPending} confirmDisabled={!credentialDraft || !reauthPassword || (mfaRequired && !reauthCode)}><div className="form-stack"><label>مقدار جدید<Input type="password" autoComplete="new-password" value={credentialDraft} onChange={(event) => setCredentialDraft(event.target.value)} dir="ltr" /></label><label>گذرواژه مدیر<Input type="password" autoComplete="current-password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} dir="ltr" /></label>{mfaRequired && <label>کد دومرحله‌ای<Input inputMode="numeric" autoComplete="one-time-code" value={reauthCode} onChange={(event) => setReauthCode(event.target.value)} dir="ltr" /></label>}</div></ConfirmDialog></Card>)}
    {slug === 'organizations.verificationdocument' && <Card className="detail-card"><div className="section-head"><h2>سند خصوصی اعتبارسنجی</h2><ArrowDownToLine size={18} /></div><Button variant="secondary" disabled={fileBusy} onClick={() => { setFileBusy(true); void resourceApi.privateFile(slug, id).then((blob) => { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `verification-document-${id}`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); notify('سند دریافت شد.') }).catch((error: unknown) => notify(error instanceof Error ? error.message : 'دریافت سند انجام نشد.', 'error')).finally(() => setFileBusy(false)) }}>{fileBusy ? 'در حال دریافت…' : 'دریافت سند خصوصی'}</Button></Card>}
    {slug === 'support.supportticket' && <Card className="detail-card ticket-thread">
      <div className="section-head"><h2>گفت‌وگوی پشتیبانی</h2><MessageSquare size={18} /></div>
      {ticketMessages.isPending ? <Loading label="در حال دریافت پیام‌ها…" /> : ticketMessages.data?.length ? <div className="ticket-messages">{ticketMessages.data.map((message) => <article className={`ticket-message${message.is_internal ? ' internal' : ''}`} key={message.id}>
        <div className="ticket-message-head"><strong>{message.sender}</strong><span>{message.is_internal ? 'یادداشت داخلی' : message.sender_type === 'staff' ? 'پشتیبانی' : 'کاربر'}</span><time>{new Date(message.created_at).toLocaleString('fa-IR')}</time></div>
        <p>{message.message}</p>
        {message.has_attachment && <Button variant="secondary" disabled={ticketAttachmentBusy === message.id} onClick={() => void downloadTicketAttachment(message.id)}><ArrowDownToLine size={15} />{ticketAttachmentBusy === message.id ? 'در حال دریافت…' : 'دریافت پیوست'}</Button>}
      </article>)}</div> : <EmptyState title="هنوز پیامی ثبت نشده است" />}
      {(descriptor.permissions?.update ?? descriptor.can_update) && <form className="ticket-reply" onSubmit={(event) => { event.preventDefault(); ticketReply.mutate() }}>
        <label className="switch-row"><input type="checkbox" checked={ticketInternal} onChange={(event) => { setTicketInternal(event.target.checked); if (event.target.checked) setTicketAttachment(null) }} /> یادداشت داخلی (برای کاربر نمایش داده نمی‌شود)</label>
        <label className="form-field"><span>{ticketInternal ? 'یادداشت داخلی' : 'پاسخ به کاربر'}</span><textarea className="input textarea" required minLength={1} maxLength={5000} value={ticketMessage} onChange={(event) => setTicketMessage(event.target.value)} /></label>
        {!ticketInternal && <label className="form-field"><span>پیوست اختیاری</span><input className="input" type="file" onChange={(event) => setTicketAttachment(event.target.files?.[0] ?? null)} /></label>}
        <div className="ticket-reauth"><label>گذرواژه مدیر<Input type="password" autoComplete="current-password" value={ticketPassword} onChange={(event) => setTicketPassword(event.target.value)} required /></label>{mfaRequired && <label>کد دومرحله‌ای<Input inputMode="numeric" autoComplete="one-time-code" value={ticketCode} onChange={(event) => setTicketCode(event.target.value)} required /></label>}</div>
        <Button type="submit" disabled={ticketReply.isPending || !ticketMessage.trim() || !ticketPassword || (mfaRequired && !ticketCode)}><Send size={16} />{ticketReply.isPending ? 'در حال ثبت…' : ticketInternal ? 'ثبت یادداشت داخلی' : 'ارسال پاسخ'}</Button>
      </form>}
    </Card>}
    {(descriptor.inlines ?? []).map((inline) => <InlinePanel key={inline.key} slug={slug} id={id} inline={inline} childDescriptor={descriptors.data?.find((item) => item.slug === inline.child_slug)} />)}
    <Card className="detail-card"><div className="section-head"><h2>جزئیات پرونده</h2><span>شناسه {id}</span></div><dl className="detail-grid">{descriptor.fields.map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{formatValue(record[`${field.name}_label`] ?? record[field.name])}</dd></div>)}</dl></Card>
    {Array.isArray(record._history) && <Card className="detail-card"><div className="section-head"><h2>تاریخچه فعالیت</h2><Clock3 size={18} /></div><div className="history-list">{record._history.map((event, index) => <pre key={index}>{formatValue(event)}</pre>)}</div></Card>}
    <ConfirmDialog open={!!pending} onOpenChange={(open) => { if (!open) { setPending(null); setReason('') } }} title={`تأیید ${pending?.label ?? 'عملیات'}`} description="این تصمیم ثبت می‌شود و ممکن است بر نمایش عمومی یا دسترسی کاربران اثر بگذارد." confirmLabel="تأیید و اجرا" onConfirm={() => pending && mutation.mutate({ key: pending.key, reason })} busy={mutation.isPending} danger={pending?.tone === 'danger'} confirmDisabled={!!pending?.requiresReason && !reason.trim()}>{pending?.requiresReason && <label className="dialog-field">دلیل تصمیم<Input value={reason} onChange={(event) => setReason(event.target.value)} autoFocus /></label>}</ConfirmDialog>
  </div>
}
