import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '@/features/home/icons'
import { useAuth } from '@/features/auth/useAuth'
import { ApiError, apiGet, apiPost, isMockMode } from '@/lib/api-client'
import {
  INTENT_GOALS,
  claimStoredGuestIntent,
  ensureGuestToken,
  markGuestIntentSaved,
  normalizeIranianMobile,
  readGuestIntent,
  type IntentGoal,
  type IntentRecord,
} from './intent'
import './intent.css'

type Phase = 'form' | 'success' | 'exit' | 'hidden'

export function HomeIntentSection() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>('form')
  const [goal, setGoal] = useState<IntentGoal | null>(null)
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [storedGuest, setStoredGuest] = useState(() => readGuestIntent())
  const signedIn = Boolean(auth.data)
  const knownGuest =
    isMockMode() || (auth.isError && auth.error instanceof ApiError && auth.error.status === 401)
  const intent = useQuery({
    queryKey: ['user-intent', auth.data?.email],
    enabled: signedIn,
    retry: false,
    queryFn: async ({ signal }) => {
      if (readGuestIntent()?.saved) await claimStoredGuestIntent()
      return apiGet<IntentRecord>('/v1/intents/me', undefined, signal)
    },
  })

  useEffect(() => {
    if (phase !== 'success') return
    const successTimer = window.setTimeout(() => setPhase('exit'), 850)
    return () => window.clearTimeout(successTimer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'exit') return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350
    const exitTimer = window.setTimeout(() => setPhase('hidden'), duration)
    return () => window.clearTimeout(exitTimer)
  }, [phase])

  if (phase === 'hidden') return null
  if (!knownGuest && !signedIn && auth.isPending) return null
  if (phase === 'form' && knownGuest && storedGuest?.saved) return null
  if (phase === 'form' && signedIn && (intent.isPending || intent.data?.has_intent)) return null

  const loadingError = !knownGuest && (!signedIn || intent.isError)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!goal || busy) {
      setError('لطفاً یک هدف را انتخاب کنید.')
      return
    }
    const normalized = normalizeIranianMobile(phone)
    if (normalized === null) {
      setError('شماره موبایل ایرانی معتبر وارد کنید؛ مانند 09123456789.')
      return
    }
    if (consent && !normalized) {
      setError('برای درخواست تماس، شماره موبایل خود را وارد کنید.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (signedIn) {
        const saved = await apiPost<IntentRecord>('/v1/intents/me', {
          goals: [goal],
          contact_phone: normalized,
          contact_consent: consent,
        })
        queryClient.setQueryData(['user-intent', auth.data?.email], saved)
      } else {
        const token = ensureGuestToken()
        await apiPost('/v1/intents/guest', {
          token,
          goals: [goal],
          contact_phone: normalized,
          contact_consent: consent,
          website: '',
        })
        markGuestIntentSaved(token, [goal])
        setStoredGuest(readGuestIntent())
      }
      setPhase('success')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'ثبت هدف انجام نشد. دوباره تلاش کنید.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={`intent-section${phase === 'exit' ? ' is-exiting' : ''}`}
      dir="rtl"
      aria-label="ثبت هدف حضور در کارفنسا"
    >
      <div className="intent-shell">
        {phase === 'success' || phase === 'exit' ? (
          <div className="intent-success" role="status">
            <span className="intent-success-icon">
              <Icon name="badge-check" />
            </span>
            <div>
              <strong>هدف شما ثبت شد</strong>
              <p>از این پس مسیرهای مرتبط‌تری به شما نشان می‌دهیم.</p>
            </div>
          </div>
        ) : loadingError ? (
          <div className="intent-load-error" role="alert">
            <Icon name="alert" />
            <span>وضعیت هدف شما دریافت نشد. برای نمایش فرم، دوباره تلاش کنید.</span>
            <button type="button" onClick={() => (signedIn ? intent.refetch() : auth.refetch())}>
              تلاش دوباره
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <header className="intent-heading">
              <div>
                <span className="intent-kicker">
                  <Icon name="compass" /> شروع هوشمند در کارفنسا
                </span>
                <h2 id="home-intent-title">با چه هدفی به کارفنسا آمده‌اید؟</h2>
                <p>
                  هدف خود را انتخاب کنید تا بتوانیم شما را به فرصت‌ها، محصولات و همکاری‌های مناسب
                  متصل کنیم.
                </p>
              </div>
              <span className="intent-step">یک انتخاب، شروعی دقیق‌تر</span>
            </header>
            <fieldset className="intent-options" disabled={busy}>
              <legend className="sr-only">هدف خود را انتخاب کنید</legend>
              {INTENT_GOALS.map((item) => (
                <label
                  key={item.id}
                  className={`intent-option${goal === item.id ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="goal"
                    value={item.id}
                    checked={goal === item.id}
                    onChange={() => {
                      setGoal(item.id)
                      setError('')
                    }}
                  />
                  <span className="intent-option-icon">
                    <Icon name={item.icon} />
                  </span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                  <span className="intent-option-check" aria-hidden="true">
                    <Icon name="badge-check" />
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="intent-bottom">
              <div className="intent-phone">
                <label htmlFor="intent-mobile">
                  شماره موبایل شما <span>(اختیاری)</span>
                </label>
                <input
                  id="intent-mobile"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="09123456789"
                  value={phone}
                  disabled={busy}
                  onChange={(event) => {
                    setPhone(event.target.value)
                    setError('')
                    if (!event.target.value.trim()) setConsent(false)
                  }}
                  aria-invalid={Boolean(error && error.includes('موبایل'))}
                  aria-describedby="intent-phone-help"
                />
                <small id="intent-phone-help">
                  در صورت تمایل، شماره خود را وارد کنید تا درباره فرصت‌های مرتبط با شما ارتباط
                  بگیریم.
                </small>
              </div>
              <label className="intent-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  با تماس یا پیامک پیگیری درباره فرصت‌های مرتبط موافقم. ثبت شماره به‌تنهایی به معنای
                  رضایت نیست.
                </span>
              </label>
              <button className="intent-submit" type="submit" disabled={busy}>
                {busy ? (
                  <span className="intent-spinner" aria-hidden="true" />
                ) : (
                  <Icon name="arrow-l" />
                )}
                {busy ? 'در حال ثبت…' : 'ثبت هدف من'}
              </button>
            </div>
            {error && (
              <p className="intent-error" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
