import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, LockKeyhole, Plus, Search, ShieldCheck, Trash2, UserRound, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { securityApi, type SecurityRole, type ObjectGrant } from '@/api/security'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Loading } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatDate, numberFormat } from '@/lib/format'
import { useResources } from '@/layouts/ControlLayout'

const createSchema = z.object({ email: z.email('ایمیل معتبر وارد کنید.'), first_name: z.string().min(1, 'نام لازم است.'), last_name: z.string().min(1, 'نام خانوادگی لازم است.'), phone: z.string().min(1, 'شماره تلفن لازم است.'), administrator: z.boolean() })
type UserDraft = z.infer<typeof createSchema>
const blankDraft: UserDraft = { email: '', first_name: '', last_name: '', phone: '', administrator: true }

function ReauthDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    setBusy(true); setError('')
    try { await authApi.reauth(password); setPassword(''); onClose(); onSuccess() }
    catch { setError('تأیید هویت انجام نشد. اطلاعات را بررسی کنید.') }
    finally { setBusy(false) }
  }
  return <ConfirmDialog open={open} onOpenChange={(value) => { if (!value) { setPassword(''); onClose() } }} title="تأیید دوباره هویت" description="برای این عملیات حساس، گذرواژه خود را دوباره وارد کنید." confirmLabel="تأیید و ادامه" onConfirm={() => void submit()} busy={busy} confirmDisabled={!password}><div className="form-stack"><label>گذرواژه<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <small className="field-error" role="alert">{error}</small>}</div></ConfirmDialog>
}

function SecurityGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const allowed = user?.is_superuser || user?.permissions?.includes('management.adminprofile.manage_permissions')
  return allowed ? children : <EmptyState title="دسترسی به مدیریت امنیت مجاز نیست" detail="سطح دسترسی شما برای این بخش کافی نیست." />
}

function UsersPanel() {
  const notify = useToast()
  const client = useQueryClient()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState<UserDraft>(blankDraft)
  const [draftError, setDraftError] = useState('')
  const [enrollmentCode, setEnrollmentCode] = useState<string | null>(null)
  const [reauthOpen, setReauthOpen] = useState(false)
  const [afterReauth, setAfterReauth] = useState<(() => void) | null>(null)
  const [pendingAction, setPendingAction] = useState<'suspend' | 'reactivate' | 'password-reset' | 'revoke' | 'grant-admin' | 'revoke-admin' | null>(null)
  const users = useQuery({ queryKey: ['security-users', search, offset], queryFn: ({ signal }) => securityApi.users(search, 20, offset, signal) })
  const detail = useQuery({ queryKey: ['security-user', selected], queryFn: ({ signal }) => securityApi.user(selected!, signal), enabled: selected !== null })
  const roles = useQuery({ queryKey: ['security-roles'], queryFn: ({ signal }) => securityApi.roles(signal) })
  const permissions = useQuery({ queryKey: ['security-permissions'], queryFn: ({ signal }) => securityApi.permissions(signal) })
  const sessions = useQuery({ queryKey: ['security-sessions', selected], queryFn: ({ signal }) => securityApi.sessions(selected!, signal), enabled: selected !== null })
  const [selectedRoles, setSelectedRoles] = useState<number[]>([])
  const [selectedActions, setSelectedActions] = useState<string[]>([])
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(q); setOffset(0) }, 350); return () => window.clearTimeout(timer) }, [q])
  useEffect(() => { setSelectedRoles(detail.data?.role_ids ?? []) }, [detail.data])
  useEffect(() => { setSelectedActions(detail.data?.individual_action_codes ?? []) }, [detail.data])
  function requireReauth(action: () => void) { setAfterReauth(() => action); setReauthOpen(true) }
  const create = useMutation({ mutationFn: securityApi.createUser, onSuccess: (result) => { setCreateOpen(false); setDraft(blankDraft); setEnrollmentCode(result.enrollment_code); notify('حساب ایجاد شد.'); void client.invalidateQueries({ queryKey: ['security-users'] }) }, onError: (error) => notify(error.message, 'error') })
  const updateRoles = useMutation({ mutationFn: (role_ids: number[]) => securityApi.setRoles(selected!, role_ids), onSuccess: () => { notify('نقش‌ها به‌روزرسانی شدند.'); void client.invalidateQueries({ queryKey: ['security-user', selected] }) }, onError: (error) => notify(error.message, 'error') })
  const updatePermissions = useMutation({ mutationFn: (action_codes: string[]) => securityApi.setPermissions(selected!, action_codes), onSuccess: () => { notify('مجوزهای اختصاصی به‌روزرسانی شدند.'); void client.invalidateQueries({ queryKey: ['security-user', selected] }) }, onError: (error) => notify(error.message, 'error') })
  const action = useMutation({ mutationFn: (name: 'suspend' | 'reactivate' | 'password-reset' | 'revoke') => name === 'revoke' ? securityApi.revokeSessions(selected!) : securityApi.userAction(selected!, name), onSuccess: () => { notify('عملیات ثبت شد.'); setPendingAction(null); void client.invalidateQueries({ queryKey: ['security-user', selected] }); void client.invalidateQueries({ queryKey: ['security-sessions', selected] }); void client.invalidateQueries({ queryKey: ['security-users'] }) }, onError: (error) => notify(error.message, 'error') })
  const adminAccess = useMutation({
    mutationFn: async (grant: boolean): Promise<{ enrollment_code?: string }> => {
      if (grant) {
        const result = await securityApi.grantAdministrator(selected!)
        return { enrollment_code: result.enrollment_code }
      }
      await securityApi.revokeAdministrator(selected!)
      return {}
    },
    onSuccess: (result) => {
      notify('دسترسی مدیریتی به‌روزرسانی شد.')
      setPendingAction(null)
      setEnrollmentCode(result.enrollment_code ?? null)
      void client.invalidateQueries({ queryKey: ['security-user', selected] })
      void client.invalidateQueries({ queryKey: ['security-users'] })
    },
    onError: (error) => notify(error.message, 'error'),
  })
  function submitCreate() {
    const valid = createSchema.safeParse(draft)
    if (!valid.success) { setDraftError(valid.error.issues[0]?.message ?? 'اطلاعات معتبر نیست.'); return }
    setDraftError('')
    if (valid.data.administrator) requireReauth(() => create.mutate(valid.data)); else create.mutate(valid.data)
  }
  function confirmAction() {
    if (!pendingAction) return
    const current = pendingAction
    setPendingAction(null)
    if (current === 'grant-admin' || current === 'revoke-admin') {
      requireReauth(() => adminAccess.mutate(current === 'grant-admin'))
      return
    }
    requireReauth(() => action.mutate(current))
  }
  return <div className="security-grid"><Card className="security-list"><div className="section-head"><h2>کاربران و مدیران</h2><Button onClick={() => setCreateOpen(true)}><Plus size={16} /> ایجاد حساب</Button></div><div className="search-input"><Search size={18} /><Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="جستجوی ایمیل یا نام…" aria-label="جستجوی کاربر" /></div>{users.isPending ? <Loading /> : users.isError ? <ErrorState error={users.error} retry={() => void users.refetch()} /> : <><div className="security-users">{users.data.items.map((item) => <button key={item.id} className={selected === item.id ? 'selected' : ''} onClick={() => setSelected(item.id)}><span className="avatar tiny">{(item.first_name || item.email).slice(0, 1)}</span><span><strong>{`${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || item.email}</strong><small>{item.email}</small></span><span className={`user-badge ${item.suspended ? 'danger' : item.is_superuser ? 'gold' : ''}`}>{item.suspended ? 'تعلیق' : item.is_superuser ? 'ارشد' : item.is_staff ? 'مدیر' : 'کاربر'}</span></button>)}</div><div className="table-footer"><span>{numberFormat.format(users.data.total)} حساب</span><div><Button variant="ghost" disabled={offset <= 0} onClick={() => setOffset(Math.max(0, offset - 20))}>قبلی</Button><Button variant="ghost" disabled={offset + 20 >= users.data.total} onClick={() => setOffset(offset + 20)}>بعدی</Button></div></div></>}</Card>
    <Card className="security-detail">{selected === null ? <EmptyState title="یک حساب را انتخاب کنید" detail="جزئیات دسترسی و نشست‌های مدیر اینجا نمایش داده می‌شود." /> : detail.isPending ? <Loading /> : detail.isError ? <ErrorState error={detail.error} retry={() => void detail.refetch()} /> : <><div className="section-head"><h2>پرونده حساب</h2><span>#{selected}</span></div><div className="security-profile"><div className="avatar">{(detail.data.first_name || detail.data.email).slice(0, 1)}</div><div><strong>{`${detail.data.first_name ?? ''} ${detail.data.last_name ?? ''}`.trim() || detail.data.email}</strong><small>{detail.data.email}</small></div></div><dl className="security-facts"><div><dt>وضعیت</dt><dd>{detail.data.suspended ? 'تعلیق شده' : detail.data.is_active ? 'فعال' : 'غیرفعال'}</dd></div><div><dt>سطح حساب</dt><dd>{detail.data.is_superuser ? 'مدیر ارشد' : detail.data.is_staff ? 'مدیر' : 'کاربر'}</dd></div><div><dt>تأیید دومرحله‌ای</dt><dd>{detail.data.mfa_confirmed ? 'فعال' : 'در انتظار راه‌اندازی'}</dd></div><div><dt>تاریخ عضویت</dt><dd>{formatDate(detail.data.date_joined)}</dd></div></dl><div className="section-head spaced"><h2>نقش‌های مدیریتی</h2><ShieldCheck size={17} /></div><div className="role-checks">{roles.data?.items.map((role) => <label key={role.id}><input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={(event) => setSelectedRoles((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} disabled={!detail.data.is_staff || detail.data.is_superuser} />{role.name}</label>)}</div>{detail.data.is_staff && !detail.data.is_superuser && <Button variant="secondary" disabled={updateRoles.isPending} onClick={() => requireReauth(() => updateRoles.mutate(selectedRoles))}>ذخیره نقش‌ها</Button>}{detail.data.is_staff && <><div className="section-head spaced"><h2>مجوزهای اختصاصی مدیر</h2><span>{selectedActions.length} انتخاب</span></div>{permissions.isPending ? <Loading /> : permissions.isError ? <ErrorState error={permissions.error} retry={() => void permissions.refetch()} /> : <div className="permission-list">{Object.entries(permissions.data.reduce<Record<string, typeof permissions.data>>((acc, item) => { (acc[item.group] ??= []).push(item); return acc }, {})).map(([group, items]) => <fieldset key={group}><legend>{group}</legend>{items.map((item) => <label key={item.code}><input type="checkbox" checked={selectedActions.includes(item.code)} disabled={detail.data.is_superuser} onChange={(event) => setSelectedActions((current) => event.target.checked ? [...current, item.code] : current.filter((code) => code !== item.code))} /><span>{item.label}</span><small>{item.code}</small></label>)}</fieldset>)}</div>}{!detail.data.is_superuser && <Button variant="secondary" disabled={updatePermissions.isPending} onClick={() => requireReauth(() => updatePermissions.mutate(selectedActions))}>ذخیره مجوزهای اختصاصی</Button>}</>}<div className="section-head spaced"><h2>نشست‌های فعال</h2><LockKeyhole size={17} /></div>{sessions.isPending ? <Loading /> : sessions.data?.items.length ? <div className="session-list">{sessions.data.items.map((session) => <div key={session.id}><strong>{session.user_agent ?? 'مرورگر ناشناس'}</strong><small>{formatDate(session.last_seen_at ?? session.created_at)}</small></div>)}</div> : <p className="muted text-small">نشست فعالی ثبت نشده است.</p>}<div className="security-actions"><Button variant="secondary" onClick={() => setPendingAction('revoke')}>لغو نشست‌ها</Button><Button variant="secondary" onClick={() => setPendingAction('password-reset')}>آغاز بازیابی گذرواژه</Button>{!detail.data.is_superuser && <Button variant={detail.data.suspended ? 'secondary' : 'danger'} onClick={() => setPendingAction(detail.data.suspended ? 'reactivate' : 'suspend')}>{detail.data.suspended ? 'فعال‌سازی دوباره' : 'تعلیق حساب'}</Button>}</div></>}</Card>
    {selected !== null && detail.data && !detail.data.is_superuser && <Card className="security-admin-access"><div className="section-head"><h2>دسترسی مدیریتی</h2><span>{detail.data.is_staff ? 'فعال' : 'غیرفعال'}</span></div><p className="muted text-small">{detail.data.is_staff ? 'لغو، نشست‌ها و مجوزهای اختصاصی مدیر را باطل می‌کند.' : 'فعال‌سازی، MFA اجباری ایجاد می‌کند و کد ثبت‌نام یک‌بارمصرف می‌سازد.'}</p>{detail.data.is_staff ? <Button variant="danger" onClick={() => setPendingAction('revoke-admin')}>لغو دسترسی مدیریتی</Button> : detail.data.is_active && <Button onClick={() => setPendingAction('grant-admin')}>اعطای دسترسی مدیریتی</Button>}</Card>}
    <ConfirmDialog open={createOpen} onOpenChange={setCreateOpen} title="ایجاد حساب" description="برای حساب مدیر، کد راه‌اندازی دومرحله‌ای فقط یک‌بار نمایش داده می‌شود." confirmLabel="ایجاد حساب" onConfirm={submitCreate} busy={create.isPending}><div className="form-stack"><label>ایمیل<Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} dir="ltr" /></label><label>نام<Input value={draft.first_name} onChange={(event) => setDraft({ ...draft, first_name: event.target.value })} /></label><label>نام خانوادگی<Input value={draft.last_name} onChange={(event) => setDraft({ ...draft, last_name: event.target.value })} /></label><label>تلفن<Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} dir="ltr" /></label><label className="switch-row"><input type="checkbox" checked={draft.administrator} onChange={(event) => setDraft({ ...draft, administrator: event.target.checked })} /> حساب مدیریتی</label>{draftError && <small className="field-error">{draftError}</small>}</div></ConfirmDialog>
    <ConfirmDialog open={!!enrollmentCode} onOpenChange={(open) => { if (!open) setEnrollmentCode(null) }} title="کد راه‌اندازی یک‌بارمصرف" description="این کد را از کانالی امن به مدیر تحویل دهید. پس از بستن این پنجره دوباره نمایش داده نمی‌شود." confirmLabel="کد را تحویل دادم" onConfirm={() => setEnrollmentCode(null)}><div className="enrollment-code" dir="ltr">{enrollmentCode}</div></ConfirmDialog>
    <ConfirmDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null) }} title={pendingAction === 'grant-admin' ? 'اعطای دسترسی مدیریتی' : pendingAction === 'revoke-admin' ? 'لغو دسترسی مدیریتی' : 'تأیید عملیات حساس'} description={pendingAction === 'grant-admin' ? 'دسترسی مدیریتی بدون مجوز گسترده اعطا می‌شود. حساب باید با ایمیل و گذرواژه وارد مرکز کنترل شود و نقش‌ها جداگانه تخصیص یابند.' : pendingAction === 'revoke-admin' ? 'نقش‌ها، مجوزهای اختصاصی و نشست‌های مدیریتی این حساب لغو خواهند شد.' : 'این تغییر بر دسترسی حساب یا نشست‌های فعال اثر می‌گذارد و در گزارش حسابرسی ثبت می‌شود.'} confirmLabel="تأیید" danger={pendingAction === 'suspend' || pendingAction === 'revoke-admin'} onConfirm={confirmAction} />
    <ReauthDialog open={reauthOpen} onClose={() => setReauthOpen(false)} onSuccess={() => { afterReauth?.(); setAfterReauth(null) }} />
    {selected !== null && detail.data?.is_staff && <ObjectGrantsPanel userId={selected} isSuperuser={detail.data.is_superuser} onReauthenticate={requireReauth} />}
  </div>
}

function ObjectGrantsPanel({ userId, isSuperuser, onReauthenticate }: { userId: number; isSuperuser: boolean; onReauthenticate: (action: () => void) => void }) {
  const notify = useToast()
  const client = useQueryClient()
  const resources = useResources()
  const [target, setTarget] = useState('')
  const [objectId, setObjectId] = useState('')
  const [actions, setActions] = useState<string[]>([])
  const [pendingRevoke, setPendingRevoke] = useState<ObjectGrant | null>(null)
  const grants = useQuery({ queryKey: ['security-object-grants', userId], queryFn: ({ signal }) => securityApi.objectGrants(userId, signal) })
  const permissions = useQuery({ queryKey: ['security-permissions'], queryFn: ({ signal }) => securityApi.permissions(signal) })
  const save = useMutation({
    mutationFn: () => {
      if (!target || !objectId.trim() || !actions.length) throw new Error('مدل، شناسه رکورد و حداقل یک مجوز لازم است.')
      const [app, model] = target.split('.')
      return securityApi.setObjectGrant(userId, app!, model!, objectId.trim(), actions.map((code) => code.split('.').at(-1)!))
    },
    onSuccess: () => {
      notify('مجوز رکوردی ثبت شد.')
      setObjectId('')
      setActions([])
      void client.invalidateQueries({ queryKey: ['security-object-grants', userId] })
    },
    onError: (error) => notify(error.message, 'error'),
  })
  const revoke = useMutation({
    mutationFn: (grant: ObjectGrant) => securityApi.revokeObjectGrant(userId, grant.app_label, grant.model_name, grant.object_id),
    onSuccess: () => {
      setPendingRevoke(null)
      notify('مجوز رکوردی لغو شد.')
      void client.invalidateQueries({ queryKey: ['security-object-grants', userId] })
    },
    onError: (error) => notify(error.message, 'error'),
  })
  const modelOptions = (permissions.data ?? []).map((item) => item.code.split('.').slice(0, 2).join('.'))
    .filter((model, index, list) => model.includes('.') && list.indexOf(model) === index)
    .filter((model) => resources.data?.some((resource) => resource.slug === model))
  const modelActions = (permissions.data ?? []).filter((item) => item.code.startsWith(`${target}.`))

  return <Card className="object-grants-card"><div className="section-head"><h2>مجوزهای رکوردی</h2><span>دسترسی محدود به شناسه‌های مشخص</span></div>
    {isSuperuser ? <EmptyState title="حساب مدیر ارشد محافظت‌شده است" detail="برای این حساب مجوز رکوردی جداگانه تغییر نمی‌کند." /> : <>
      {grants.isPending ? <Loading /> : grants.isError ? <ErrorState error={grants.error} retry={() => void grants.refetch()} /> : grants.data.items.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>مدل</th><th>شناسه</th><th>مجوزها</th><th>عملیات</th></tr></thead><tbody>{grants.data.items.map((grant) => <tr key={grant.id}><td>{grant.app_label}.{grant.model_name}</td><td>{grant.object_id}</td><td>{grant.actions.join(', ')}</td><td><Button variant="danger" onClick={() => setPendingRevoke(grant)}>لغو</Button></td></tr>)}</tbody></table></div> : <EmptyState title="مجوز رکوردی ثبت نشده است" />}
      <div className="object-grant-form"><label>مدل<select className="input" value={target} onChange={(event) => { setTarget(event.target.value); setActions([]) }}><option value="">انتخاب مدل</option>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}</select></label><label>شناسه رکورد<Input value={objectId} onChange={(event) => setObjectId(event.target.value)} dir="ltr" /></label></div>
      {target && <div className="role-checks">{modelActions.map((item) => <label key={item.code}><input type="checkbox" checked={actions.includes(item.code)} onChange={(event) => setActions((current) => event.target.checked ? [...current, item.code] : current.filter((code) => code !== item.code))} />{item.label}</label>)}</div>}
      <div className="form-footer"><Button disabled={save.isPending || !target || !objectId.trim() || !actions.length} onClick={() => onReauthenticate(() => save.mutate())}><ShieldCheck size={16} />ثبت دسترسی رکورد</Button></div>
    </>}
    <ConfirmDialog open={!!pendingRevoke} onOpenChange={(open) => { if (!open) setPendingRevoke(null) }} title="لغو مجوز رکوردی" description="دسترسی انتخاب‌شده برای این حساب بلافاصله لغو می‌شود." confirmLabel="لغو دسترسی" danger busy={revoke.isPending} onConfirm={() => { if (pendingRevoke) onReauthenticate(() => revoke.mutate(pendingRevoke)) }} />
  </Card>
}

function RolesPanel() {
  const notify = useToast(); const client = useQueryClient()
  const roles = useQuery({ queryKey: ['security-roles'], queryFn: ({ signal }) => securityApi.roles(signal) })
  const permissions = useQuery({ queryKey: ['security-permissions'], queryFn: ({ signal }) => securityApi.permissions(signal) })
  const [editing, setEditing] = useState<number | null>(null)
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [codes, setCodes] = useState<string[]>([]); const [active, setActive] = useState(true)
  const [reauthOpen, setReauthOpen] = useState(false)
  const save = useMutation({ mutationFn: () => securityApi.saveRole({ name, description, action_codes: codes, is_active: active }, editing ?? undefined), onSuccess: () => { notify('نقش ذخیره شد.'); setEditing(null); setName(''); setDescription(''); setCodes([]); void client.invalidateQueries({ queryKey: ['security-roles'] }) }, onError: (error) => notify(error.message, 'error') })
  const duplicate = useMutation({
    mutationFn: (id: number) => securityApi.duplicateRole(id),
    onSuccess: (role) => {
      notify('نقش تکثیر شد.')
      void client.invalidateQueries({ queryKey: ['security-roles'] })
      edit(role)
    },
    onError: (error) => notify(error.message, 'error'),
  })
  function edit(role: SecurityRole) { setEditing(role.id); setName(role.name); setDescription(role.description); setCodes(role.action_codes); setActive(role.is_active) }
  return <div className="security-grid"><Card className="security-list"><div className="section-head"><h2>نقش‌ها</h2><Button onClick={() => { setEditing(null); setName(''); setDescription(''); setCodes([]); setActive(true) }}><Plus size={16} /> نقش جدید</Button></div>{roles.isPending ? <Loading /> : roles.isError ? <ErrorState error={roles.error} retry={() => void roles.refetch()} /> : <div className="role-list">{roles.data.items.map((role) => <button key={role.id} onClick={() => edit(role)} className={editing === role.id ? 'selected' : ''}><ShieldCheck size={18} /><span><strong>{role.name}</strong><small>{numberFormat.format(role.action_codes.length)} مجوز · {role.is_active ? 'فعال' : 'غیرفعال'}</small></span></button>)}</div>}</Card><Card className="security-detail"><div className="section-head"><h2>{editing ? 'ویرایش نقش' : 'نقش جدید'}</h2><KeyRound size={18} /></div><div className="form-stack"><label>نام نقش<Input value={name} onChange={(event) => setName(event.target.value)} /></label><label>توضیح<Input value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="switch-row"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> فعال</label></div><div className="section-head spaced"><h2>مجوزهای قابل اعطا</h2><span>{numberFormat.format(codes.length)} انتخاب</span></div>{permissions.isPending ? <Loading /> : permissions.isError ? <ErrorState error={permissions.error} retry={() => void permissions.refetch()} /> : <div className="permission-list">{Object.entries(permissions.data.reduce<Record<string, typeof permissions.data>>((acc, item) => { (acc[item.group] ??= []).push(item); return acc }, {})).map(([group, items]) => <fieldset key={group}><legend>{group}</legend>{items.map((item) => <label key={item.code}><input type="checkbox" checked={codes.includes(item.code)} onChange={(event) => setCodes((current) => event.target.checked ? [...current, item.code] : current.filter((code) => code !== item.code))} /><span>{item.label}</span><small>{item.code}</small></label>)}</fieldset>)}</div>}<div className="form-footer"><Button disabled={!name.trim() || save.isPending} onClick={() => setReauthOpen(true)}><ShieldCheck size={16} /> ذخیره نقش</Button>{editing !== null && <Button variant="ghost" disabled={duplicate.isPending} onClick={() => duplicate.mutate(editing)}>تکثیر نقش</Button>}</div></Card><ReauthDialog open={reauthOpen} onClose={() => setReauthOpen(false)} onSuccess={() => save.mutate()} /></div>
}

function GroupsPanel() {
  const notify = useToast()
  const client = useQueryClient()
  const [selected, setSelected] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [permissionIds, setPermissionIds] = useState<number[]>([])
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [reauthOpen, setReauthOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [afterReauth, setAfterReauth] = useState<(() => void) | null>(null)
  const groups = useQuery({ queryKey: ['security-groups'], queryFn: ({ signal }) => securityApi.groups(signal) })
  const detail = useQuery({ queryKey: ['security-group', selected], queryFn: ({ signal }) => securityApi.group(selected!, signal), enabled: selected !== null })
  const permissions = useQuery({ queryKey: ['security-group-permissions'], queryFn: ({ signal }) => securityApi.groupPermissions(signal) })
  const users = useQuery({
    queryKey: ['security-group-members-search', userSearch],
    queryFn: ({ signal }) => securityApi.users(userSearch, 100, 0, signal),
    enabled: selected !== null,
  })
  useEffect(() => {
    if (!detail.data) return
    setName(detail.data.name)
    setPermissionIds(detail.data.permission_ids)
    setMemberIds(detail.data.member_ids)
  }, [detail.data])
  const save = useMutation({
    mutationFn: () => securityApi.saveGroup({ name, permission_ids: permissionIds }, selected ?? undefined),
    onSuccess: (group) => {
      notify('گروه و مجوزهای Django ذخیره شدند.')
      setSelected(group.id)
      void client.invalidateQueries({ queryKey: ['security-groups'] })
      void client.invalidateQueries({ queryKey: ['security-group', group.id] })
    },
    onError: (error) => notify(error.message, 'error'),
  })
  const saveMembers = useMutation({
    mutationFn: () => {
      if (selected === null) throw new Error('ابتدا گروه را ذخیره کنید.')
      return securityApi.setGroupMembers(selected, memberIds)
    },
    onSuccess: (group) => {
      setMemberIds(group.member_ids)
      notify('اعضای گروه به‌روزرسانی شدند.')
      void client.invalidateQueries({ queryKey: ['security-groups'] })
      void client.invalidateQueries({ queryKey: ['security-group', selected] })
    },
    onError: (error) => notify(error.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: () => securityApi.deleteGroup(selected!),
    onSuccess: () => {
      notify('گروه حذف شد.')
      setSelected(null)
      setName('')
      setPermissionIds([])
      setMemberIds([])
      void client.invalidateQueries({ queryKey: ['security-groups'] })
    },
    onError: (error) => notify(error.message, 'error'),
  })
  function requireReauth(action: () => void) {
    setAfterReauth(() => action)
    setReauthOpen(true)
  }
  const groupedPermissions = permissions.data?.reduce<Record<string, typeof permissions.data>>((acc, item) => {
    ;(acc[item.group] ??= []).push(item)
    return acc
  }, {})

  return <div className="security-grid">
    <Card className="security-list">
      <div className="section-head"><h2>گروه‌های Django</h2><Button onClick={() => { setSelected(null); setName(''); setPermissionIds([]); setMemberIds([]) }}><Plus size={16} /> گروه جدید</Button></div>
      {groups.isPending ? <Loading /> : groups.isError ? <ErrorState error={groups.error} retry={() => void groups.refetch()} /> : groups.data.items.length ? <div className="role-list">{groups.data.items.map((group) => <button key={group.id} onClick={() => setSelected(group.id)} className={selected === group.id ? 'selected' : ''}><Users size={18} /><span><strong>{group.name}</strong><small>{group.member_count} عضو · {group.permission_ids.length} مجوز</small></span></button>)}</div> : <EmptyState title="گروهی ثبت نشده است" />}
    </Card>
    <Card className="security-detail">
      {selected !== null && detail.isPending ? <Loading /> : selected !== null && detail.isError ? <ErrorState error={detail.error} retry={() => void detail.refetch()} /> : <>
        <div className="section-head"><h2>{selected === null ? 'ایجاد گروه دسترسی' : 'ویرایش گروه دسترسی'}</h2><ShieldCheck size={18} /></div>
        <div className="form-stack"><label>نام گروه<Input value={name} onChange={(event) => setName(event.target.value)} maxLength={150} /></label></div>
        <div className="section-head spaced"><h2>مجوزهای مدل Django</h2><span>{permissionIds.length} انتخاب</span></div>
        {permissions.isPending ? <Loading /> : permissions.isError ? <ErrorState error={permissions.error} retry={() => void permissions.refetch()} /> : <div className="permission-list">{Object.entries(groupedPermissions ?? {}).map(([group, items]) => <fieldset key={group}><legend>{group}</legend>{items.map((permission) => <label key={permission.id}><input type="checkbox" checked={permissionIds.includes(permission.id)} onChange={(event) => setPermissionIds((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} /><span>{permission.label}</span><small>{permission.code}</small></label>)}</fieldset>)}</div>}
        <div className="form-footer"><Button disabled={!name.trim() || save.isPending} onClick={() => requireReauth(() => save.mutate())}><ShieldCheck size={16} />ذخیره گروه</Button>{selected !== null && <Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={16} />حذف گروه</Button>}</div>
        {selected !== null && <><div className="section-head spaced"><h2>اعضای گروه</h2><span>{memberIds.length} انتخاب</span></div><div className="search-input"><Search size={18} /><Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="یافتن حساب با ایمیل یا نام…" aria-label="جستجوی اعضای گروه" /></div>{memberIds.length > 0 && <div className="selected-member-ids">{memberIds.map((id) => <button key={id} type="button" onClick={() => setMemberIds((current) => current.filter((currentId) => currentId !== id))}>#{id} ×</button>)}</div>}{users.isPending ? <Loading /> : users.isError ? <ErrorState error={users.error} retry={() => void users.refetch()} /> : <div className="group-user-picker">{users.data.items.map((user) => <label key={user.id}><input type="checkbox" checked={memberIds.includes(user.id)} disabled={user.is_superuser} onChange={(event) => setMemberIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} /><span><strong>{`${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email}</strong><small>{user.email}{user.is_superuser ? ' · مدیر ارشد محافظت‌شده' : ''}</small></span></label>)}</div>}<div className="form-footer"><Button variant="secondary" disabled={saveMembers.isPending} onClick={() => requireReauth(() => saveMembers.mutate())}>ذخیره اعضای گروه</Button></div></>}
      </>}
    </Card>
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="حذف گروه Django" description="حذف گروه، عضویت‌های آن را حذف می‌کند اما حساب‌ها و مجوزهای مستقل را حفظ می‌کند." confirmLabel="حذف گروه" danger onConfirm={() => { setDeleteOpen(false); requireReauth(() => remove.mutate()) }} busy={remove.isPending} />
    <ReauthDialog open={reauthOpen} onClose={() => setReauthOpen(false)} onSuccess={() => { afterReauth?.(); setAfterReauth(null) }} />
  </div>
}

function AuditPanel() {
  const [offset, setOffset] = useState(0); const [action, setAction] = useState('')
  const query = useQuery({ queryKey: ['security-audit', offset, action], queryFn: ({ signal }) => securityApi.audit(30, offset, action, signal) })
  return <Card className="audit-card"><div className="section-head"><h2>گزارش فعالیت مدیران</h2><span>فقط خواندنی</span></div><div className="audit-filter"><label>نوع عملیات<Input value={action} onChange={(event) => { setAction(event.target.value); setOffset(0) }} placeholder="فیلتر نوع عملیات" /></label></div>{query.isPending ? <Loading /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data.items.length === 0 ? <EmptyState title="رویدادی پیدا نشد" /> : <><div className="table-scroll"><table className="data-table"><thead><tr><th>زمان</th><th>مدیر</th><th>عملیات</th><th>هدف</th><th>نتیجه</th></tr></thead><tbody>{query.data.items.map((entry) => <tr key={entry.id}><td>{formatDate(entry.created_at)}</td><td>{entry.actor ?? 'نامشخص'}</td><td>{entry.action}</td><td>{[entry.target_app, entry.target_model, entry.target_id].filter(Boolean).join(' / ') || '—'}</td><td>{entry.result ?? '—'}</td></tr>)}</tbody></table></div><div className="table-footer"><span>{numberFormat.format(query.data.total)} رویداد</span><div><Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 30))}>قبلی</Button><Button variant="ghost" disabled={offset + 30 >= query.data.total} onClick={() => setOffset(offset + 30)}>بعدی</Button></div></div></>}</Card>
}

export default function SecurityPage() {
  const [params, setParams] = useSearchParams(); const tab = params.get('tab') ?? 'users'
  return <SecurityGate><div className="page-stack"><div className="page-heading"><div><div className="eyebrow">حاکمیت و دسترسی</div><h1>امنیت و مدیران</h1><p>حساب‌ها، نقش‌ها، نشست‌ها و گزارش‌های حسابرسی</p></div></div><div className="security-tabs" role="tablist">{[['users', 'کاربران و مدیران', Users], ['roles', 'نقش‌ها و مجوزها', ShieldCheck], ['groups', 'گروه‌های Django', Users], ['audit', 'تاریخچه فعالیت', UserRound]].map(([key, label, Icon]) => { const IconComponent = Icon as typeof Users; return <button key={key as string} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setParams({ tab: key as string })}><IconComponent size={17} /> {label as string}</button> })}</div>{tab === 'roles' ? <RolesPanel /> : tab === 'groups' ? <GroupsPanel /> : tab === 'audit' ? <AuditPanel /> : <UsersPanel />}</div></SecurityGate>
}
