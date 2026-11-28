import { Icon } from '@/features/home/icons'
import { usePwa } from './pwa-context'

interface Props {
  className?: string
}

export function PwaInstallButton({ className = '' }: Props) {
  const { installed, installMethod, requestInstall } = usePwa()
  if (installed) return null
  const directInstall = installMethod === 'native' || installMethod === 'ios-safari'

  return (
    <button
      type="button"
      className={`pwa-install-button ${className}`.trim()}
      onClick={(event) => void requestInstall(event.currentTarget)}
    >
      <Icon name="download" />
      <span>{directInstall ? 'نصب اپلیکیشن' : 'راهنمای نصب'}</span>
    </button>
  )
}

export function PwaPromoCard({ placement = 'drawer' }: { placement?: 'drawer' | 'home' }) {
  const { installed, installMethod } = usePwa()
  if (installed) return null
  const supportText = {
    native: 'نصب مستقیم، بدون نیاز به فروشگاه',
    'ios-safari': 'افزودن به صفحه اصلی از طریق Safari',
    'browser-menu': 'راهنمای افزودن از منوی مرورگر',
    unavailable: 'نصب مستقیم در این مرورگر در دسترس نیست',
  }[installMethod]

  return (
    <section
      className={`pwa-promo-card pwa-promo-card--${placement}`}
      aria-label="اپلیکیشن کارفنسا"
    >
      <img src="/icons/icon-192.png" width="56" height="56" alt="" />
      <div className="pwa-promo-copy">
        <strong>اپلیکیشن کارفنسا</strong>
        <span>دنیای تجارت، همیشه همراه شما</span>
        <small>دسترسی سریع به فرصت‌های تجاری، شرکت‌ها و خدمات</small>
      </div>
      <PwaInstallButton className="pwa-promo-action" />
      <small>{supportText}</small>
    </section>
  )
}
