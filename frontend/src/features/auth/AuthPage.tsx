import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { Logo } from '@/components/layout/Logo'
import { apiPost } from '@/lib/api-client'
import {
  claimStoredGuestIntent,
  clearGuestIntent,
  readGuestIntent,
} from '@/features/intents/intent'
import './auth.css'
import './auth-responsive.css'

type Mode = 'login' | 'register'
type Step = 'details' | 'reset' | 'reset-code'

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('details')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const data = new FormData(event.currentTarget)
    try {
      if (step === 'reset') {
        const submittedEmail = String(data.get('email') ?? '').trim()
        setEmail(submittedEmail)
        await apiPost('/v1/auth/password-reset', { email: submittedEmail })
        setStep('reset-code')
        setMessage('اگر این ایمیل در کارفنسا ثبت شده باشد، کد بازیابی برای آن ارسال می‌شود.')
        return
      }
      if (step === 'reset-code') {
        await apiPost('/v1/auth/password-reset/confirm', {
          email,
          code: data.get('code'),
          password: data.get('password'),
        })
        setStep('details')
        setMode('login')
        setMessage('گذرواژه تغییر کرد. با گذرواژهٔ جدید وارد شوید.')
        return
      }

      const submittedEmail = String(data.get('email') ?? '').trim()
      setEmail(submittedEmail)
      if (mode === 'register') {
        const password = String(data.get('password') ?? '')
        const passwordConfirmation = String(data.get('password_confirmation') ?? '')
        if (password !== passwordConfirmation) {
          setError('گذرواژه و تکرار آن یکسان نیستند.')
          return
        }
        const guest = readGuestIntent()
        const registration = await apiPost<{ intent_claimed: boolean }>('/v1/auth/register', {
          email: submittedEmail,
          phone: data.get('phone'),
          password,
          guest_intent_token: guest?.saved ? guest.token : null,
        })
        if (registration.intent_claimed) clearGuestIntent()
        setMode('login')
        setMessage('حساب ساخته شد. برای ورود، ایمیل و گذرواژه را وارد کنید.')
      } else {
        await apiPost('/v1/auth/password-login', {
          email: submittedEmail,
          password: data.get('password'),
        })
        try {
          await claimStoredGuestIntent()
        } catch {
          // Home retries the transfer after authentication; keep the local token.
        }
        const state = location.state as { returnTo?: string } | null
        const destination = new URL(state?.returnTo || '/', window.location.origin)
        window.location.assign(
          destination.origin === window.location.origin
            ? `${destination.pathname}${destination.search}${destination.hash}`
            : '/',
        )
      }
    } catch (cause) {
      const body =
        cause instanceof Error && 'body' in cause
          ? (cause as { body?: { error?: { message?: string } } }).body
          : undefined
      setError(
        body?.error?.message ??
          (cause instanceof TypeError
            ? 'اتصال به سرور برقرار نشد. مطمئن شوید سرویس backend در حال اجراست.'
            : cause instanceof Error
              ? cause.message
              : 'مشکلی پیش آمد. دوباره تلاش کنید.'),
      )
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    const state = location.state as { backgroundLocation?: unknown } | null
    if (state?.backgroundLocation) navigate(-1)
    else navigate('/')
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const state = location.state as { backgroundLocation?: unknown } | null
      if (state?.backgroundLocation) navigate(-1)
      else navigate('/')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [location, navigate])

  const title =
    step === 'reset'
      ? 'بازیابی گذرواژه'
      : step === 'reset-code'
        ? 'گذرواژهٔ تازه بسازید'
        : mode === 'login'
          ? 'خوش آمدید'
          : 'حساب خود را بسازید'

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        className={`auth-page auth-page--${mode} auth-page--${step}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <div className="auth-card">
          <button type="button" className="auth-back" onClick={close}>
            بستن
          </button>
          <div className="auth-brand">
            <Logo />
          </div>
          <p className="auth-eyebrow">حساب کاربری کارفنسا</p>
          <h1 id="auth-title" key={title} className="auth-title">
            {title}
          </h1>
          <p className="auth-intro">
            {step === 'reset'
              ? 'ایمیل حسابتان را وارد کنید تا کد امن بازیابی برایتان ارسال شود.'
              : step === 'reset-code'
                ? `کد ارسال‌شده به ${email} و گذرواژهٔ تازه را وارد کنید.`
                : 'برای دنبال‌کردن خبرها و تحلیل‌های اقتصادی وارد حساب خود شوید.'}
          </p>
          {step === 'details' && (
            <p className="auth-intro">
              <AppLink href="/join">ثبت‌نام کسب‌وکار با شماره موبایل</AppLink>
            </p>
          )}
          {step === 'details' && (
            <div className="auth-tabs" role="tablist" aria-label="نوع دسترسی">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={mode === 'login' ? 'active' : ''}
                onClick={() => {
                  setMode('login')
                  setError('')
                  setMessage('')
                }}
              >
                ورود
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={mode === 'register' ? 'active' : ''}
                onClick={() => {
                  setMode('register')
                  setError('')
                  setMessage('')
                }}
              >
                ثبت‌نام
              </button>
            </div>
          )}
          <form onSubmit={submit} className="auth-form" key={`${mode}-${step}`}>
            {step === 'details' && mode === 'register' && (
              <label>
                شماره تلفن
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  placeholder="09123456789"
                  dir="ltr"
                />
              </label>
            )}
            {(step === 'details' || step === 'reset') && (
              <label>
                ایمیل
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                  dir="ltr"
                  defaultValue={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}
            {step === 'details' && (
              <label>
                گذرواژه
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={mode === 'register' ? 12 : undefined}
                  required
                  placeholder={mode === 'register' ? 'حداقل ۱۲ نویسه' : 'گذرواژهٔ حساب'}
                  dir="ltr"
                />
              </label>
            )}
            {step === 'details' && mode === 'register' && (
              <label>
                تکرار گذرواژه
                <input
                  name="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  placeholder="گذرواژه را دوباره وارد کنید"
                  dir="ltr"
                />
              </label>
            )}
            {step === 'reset-code' && (
              <>
                <label>
                  کد بازیابی
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    placeholder="کد ۶ رقمی"
                    dir="ltr"
                  />
                </label>
                <label>
                  گذرواژهٔ جدید
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    placeholder="حداقل ۱۲ نویسه"
                    dir="ltr"
                  />
                </label>
              </>
            )}
            {mode === 'login' && step === 'details' && (
              <button
                type="button"
                className="auth-forgot"
                onClick={() => {
                  setStep('reset')
                  setError('')
                  setMessage('')
                }}
              >
                گذرواژه را فراموش کرده‌اید؟
              </button>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="auth-message" role="status">
                {message}
              </p>
            )}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy
                ? 'لطفاً صبر کنید…'
                : step === 'reset'
                  ? 'ارسال کد بازیابی'
                  : step === 'reset-code'
                    ? 'ذخیرهٔ گذرواژهٔ جدید'
                    : mode === 'login'
                      ? 'ورود به حساب'
                      : 'ساخت حساب کاربری'}
              <span aria-hidden="true">←</span>
            </button>
          </form>
          <p className="auth-terms">
            ورود شما به معنی پذیرش قوانین استفاده و حریم خصوصی کارفنساست.
          </p>
        </div>
        <aside className="auth-aside" aria-label="معرفی کارفنسا">
          <div className="auth-orbit orbit-one" />
          <div className="auth-orbit orbit-two" />
          <div className="auth-aside-content">
            <span className="auth-aside-kicker">KARFANSA · INSIGHT</span>
            <h2>
              اقتصاد را
              <br />
              <em>روشن‌تر</em> ببین.
            </h2>
            <p>نبض بازار و تحلیل‌های قابل‌اعتماد، همیشه همراه شما.</p>
            <div className="auth-aside-foot">
              <span className="auth-live-dot" /> نگاه دقیق‌تر به فردای اقتصاد
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
