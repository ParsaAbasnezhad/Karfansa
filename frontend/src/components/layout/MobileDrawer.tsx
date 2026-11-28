import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { SearchForm } from '@/features/home/SearchForm'
import { Icon } from '@/features/home/icons'
import { DRAWER_LINKS, NAV, SOCIAL, TRENDING, URLS } from '@/lib/site'
import { Logo } from './Logo'
import { PwaPromoCard } from '@/pwa/PwaInstallButton'

interface Props {
  open: boolean
  onClose: () => void
  today: string
  time: string
  authenticated: boolean
}

export function MobileDrawer({ open, onClose, today, time, authenticated }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const asideRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // `inert` keeps the closed drawer out of the tab order. React 18 has no prop for it, so set it directly.
  useEffect(() => {
    if (asideRef.current) asideRef.current.inert = !open
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onClose()
    }
    const mq = matchMedia('(min-width:641px)')
    const onMq = (e: MediaQueryListEvent) => {
      if (e.matches) onClose()
    }
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
  }, [open, onClose])

  return (
    <>
      <div className={'scrim' + (open ? ' open' : '')} onClick={onClose} aria-hidden="true" />
      <aside ref={asideRef} className={'drawer' + (open ? ' open' : '')} aria-label="منوی کارفنسا">
        <div className="dh">
          <div className="row">
            <Logo />
            <button
              ref={closeRef}
              type="button"
              className="dclose"
              aria-label="بستن منو"
              onClick={onClose}
            >
              <Icon name="x" />
            </button>
          </div>
          <div className="dd">
            <Icon name="calendar" />
            <span>{today}</span>
            <b>
              <i />
              <span>{time}</span>
            </b>
          </div>
        </div>

        <div className="dscroll">
          <SearchForm variant="drawer" onDone={onClose} />
          <PwaPromoCard />

          <div className="dt">بخش‌ها</div>
          <nav className="dnav" aria-label="بخش‌ها">
            {NAV.map((n) => (
              <AppLink
                key={n.href}
                href={n.href}
                className={n.href === pathname ? 'on' : ''}
                onClick={onClose}
              >
                <span className="ti">
                  <Icon name={n.icon} />
                </span>
                {n.label}
                {n.live && <span className="nb">زنده</span>}
                <Icon name="chev-l" className="ch" />
              </AppLink>
            ))}
          </nav>

          <div className="dt">موضوعات داغ</div>
          <div className="dchips">
            {TRENDING.map((t) => (
              <AppLink key={t.href} href={t.href} onClick={onClose}>
                {t.label}
              </AppLink>
            ))}
          </div>

          <div className="dt">کارفنسا</div>
          <div className="dlinks">
            {DRAWER_LINKS.map((l) => (
              <AppLink key={l.href} href={l.href} onClick={onClose}>
                {l.label}
              </AppLink>
            ))}
          </div>
        </div>

        <div className="dfoot">
          {authenticated ? (
            <AppLink className="btn" href="/account/" onClick={onClose}>
              <Icon name="user" />
              پنل کاربری
            </AppLink>
          ) : (
            <AppLink className="btn" href={URLS.login} onClick={onClose}>
              <Icon name="user" />
              ورود / ثبت‌نام
            </AppLink>
          )}
          <div className="row2">
            <div className="dsoc">
              {SOCIAL.slice(0, 3).map((s) => (
                <a
                  key={s.icon}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                >
                  <Icon name={s.icon} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
