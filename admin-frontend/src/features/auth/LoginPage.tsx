import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { useAuth } from './AuthProvider'
import { Button, Input } from '@/components/ui'

const emailSchema = z.string().optional().transform((email) => email?.trim() ?? '').pipe(z.string().min(1, 'ایمیل معتبر وارد کنید.').refine((email) => {
  if (!email) return true
  if (z.email().safeParse(email).success) return true
  const at = email.lastIndexOf('@')
  if (at < 1) return false
  const domain = email.slice(at + 1)
  return !domain.includes('.') &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(domain) &&
    z.email().safeParse(`${email.slice(0, at)}@example.com`).success
}, 'ایمیل معتبر وارد کنید.'))

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().optional().transform((password) => password ?? '').pipe(z.string().min(1, 'گذرواژه را وارد کنید.')),
})
type Credentials = z.infer<typeof credentialsSchema>
type CredentialsInput = z.input<typeof credentialsSchema>

export default function LoginPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<CredentialsInput, unknown, Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  })

  if (user) return <Navigate to="/" replace />

  async function onCredentials(values: Credentials) {
    setBusy(true); setError('')
    try {
      const result = await authApi.login(values.email, values.password)
      if (result.mfa_required) {
        setError('ورود فقط با ایمیل و گذرواژه پشتیبانی می‌شود. با مدیر سامانه تماس بگیرید.')
        return
      }
      await refresh()
      navigate('/', { replace: true })
    } catch { setError('ورود انجام نشد. اطلاعات را بررسی کرده و دوباره تلاش کنید.') }
    finally { setBusy(false) }
  }

  return <main className="login-page"><div className="login-brand"><div className="brand-mark"><span>ک</span></div><div><strong>کارفنسا</strong><span>مرکز کنترل سازمانی</span></div></div>
    <div className="login-shell"><div className="login-intro"><div className="eyebrow"><ShieldCheck size={16} /> فضای مدیریت امن</div><h1>Karfansa<br /><span>Control Center</span></h1><p>مدیریت دقیق پلتفرم، داده‌ها و گردش‌کارهای تجاری در یک فضای متمرکز.</p><div className="login-seal"><LockKeyhole size={18} /> دسترسی فقط برای مدیران مجاز</div></div>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card-icon"><Fingerprint size={27} /></div>
        <h2 id="login-title">ورود مدیران</h2>
        <p className="muted">با ایمیل و گذرواژه مدیریتی خود وارد شوید.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <form noValidate onSubmit={handleSubmit(onCredentials)} className="form-stack">
          <label>ایمیل مدیریتی<Input type="text" inputMode="email" autoComplete="username" dir="ltr" {...register('email')} /></label>{errors.email && <small className="field-error">{errors.email.message}</small>}
          <label>گذرواژه<Input type="password" autoComplete="current-password" dir="ltr" {...register('password')} /></label>{errors.password && <small className="field-error">{errors.password.message}</small>}
          <Button type="submit" disabled={busy} className="full">{busy ? 'در حال بررسی…' : 'ورود به مرکز کنترل'}<ArrowLeft size={18} /></Button>
        </form>
        <div className="login-footer"><ShieldCheck size={15} /> نشست شما با کوکی امن و کنترل دسترسی سمت سرور محافظت می‌شود.</div>
      </section>
    </div><div className="login-bottom"><Link to="https://karfansa.ir">بازگشت به کارفنسا</Link><span>© کارفنسا</span></div>
  </main>
}
