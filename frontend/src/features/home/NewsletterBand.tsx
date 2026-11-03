import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '@/components/toast-context'
import { ApiError, apiPost } from '@/lib/api-client'
import { Icon } from './icons'

/** Email sign-up. POST /api/newsletter/ with { email }. */
export function NewsletterBand() {
  const toast = useToast()
  const [email, setEmail] = useState('')

  const subscribe = useMutation({
    mutationFn: (value: string) => apiPost<{ ok: boolean }>('/newsletter/', { email: value }),
    onSuccess: () => {
      toast('عضویت شما در خبرنامه ثبت شد.')
      setEmail('')
    },
    onError: (err) =>
      toast(
        err instanceof ApiError && err.status === 400
          ? 'ایمیل واردشده معتبر نیست.'
          : 'ثبت عضویت انجام نشد. دوباره تلاش کنید.',
      ),
  })

  return (
    <div className="news" id="nl">
      <div className="l">
        <span className="bellbox">
          <Icon name="bell" />
        </span>
        <div>
          <h3>خبرنامه اقتصادی کارفنسا</h3>
          <p>مهم‌ترین اخبار بازار و شرکت‌ها، هر روز صبح در ایمیل شما.</p>
        </div>
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          subscribe.mutate(email)
        }}
      >
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ایمیل خود را وارد کنید..."
          aria-label="ایمیل"
          required
        />
        <button className="btn" type="submit" disabled={subscribe.isPending}>
          عضویت
        </button>
      </form>
    </div>
  )
}
