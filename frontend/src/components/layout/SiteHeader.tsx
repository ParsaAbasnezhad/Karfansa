import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { useAuth } from '@/features/auth/useAuth'
import { NotificationBell } from '@/features/inquiries/NotificationBell'
import { useMarkets } from '@/features/home/data'
import { Icon } from '@/features/home/icons'
import { SearchForm } from '@/features/home/SearchForm'
import { formatChange, formatNumber } from '@/lib/format'
import { useTehranClock } from '@/lib/hooks'
import { NAV, SOCIAL, TOP_LINKS, URLS } from '@/lib/site'
import { Logo } from './Logo'
import { MobileDrawer } from './MobileDrawer'

export function SiteHeader() {
  const clock = useTehranClock()
  const { pathname } = useLocation()
  const { data: user } = useAuth()
  const markets = useMarkets().data?.results
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const burgerRef = useRef<HTMLButtonElement>(null)

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    burgerRef.current?.focus({ preventScroll: true })
  }, [])

  const focusSearch = () => setTimeout(() => document.getElementById('q')?.focus(), 0)

  // Press "/" anywhere to jump to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName ?? ''
      if (e.key !== '/' || /INPUT|TEXTAREA|SELECT/.test(tag)) return
      e.preventDefault()
      setSearchOpen(true)
      focusSearch()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <div className="date">
            <Icon name="calendar" />
            <span>{clock.today}</span>
            <span className="sep" />
            <span className="tm">
              <i />
              <span>{clock.time}</span>
            </span>
          </div>
          <div className="quotes" aria-label="نرخ‌های لحظه‌ای">
            {(markets ?? []).map((m) => (
              <span className="quote" key={m.id}>
                {m.short_title} <b>{formatNumber(m.value)}</b>
                <em className={m.change < 0 ? 'down' : ''}>
                  {formatChange(m.change).replace(/^[+−]/, '')}
                </em>
              </span>
            ))}
          </div>
          <div className="links">
            {TOP_LINKS.map((l) => (
              <AppLink key={l.href} href={l.href}>
                {l.label}
              </AppLink>
            ))}
            <div className="soc2">
              {SOCIAL.filter((s) => s.icon !== 'whatsapp').map((s) => (
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
      </div>

      <header className={'masthead' + (searchOpen ? ' sopen' : '')}>
        <div className="wrap">
          <button
            ref={burgerRef}
            type="button"
            className="iconbtn burger"
            aria-label="منو"
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <Logo />
          <SearchForm variant="masthead" />
          <div className="mast-tools">
            <NotificationBell enabled={Boolean(user)} />
            <button
              type="button"
              className="iconbtn sbtn"
              aria-label="جستجو"
              onClick={() => {
                setSearchOpen((o) => !o)
                focusSearch()
              }}
            >
              <Icon name="search" />
            </button>
            {user ? (
              <AppLink className="btn login" href="/account/">
                <Icon name="user" />
                <span>پنل کاربری</span>
              </AppLink>
            ) : (
              <AppLink className="btn login" href={URLS.login}>
                <Icon name="user" />
                <span className="desktop-label">ورود / ثبت‌نام</span>
                <span className="mobile-label">ثبت‌نام</span>
              </AppLink>
            )}
          </div>
        </div>
      </header>

      <nav className="navbar" aria-label="منوی اصلی">
        <div className="wrap">
          <div className="mainnav">
            {NAV.map((n) => (
              <AppLink
                key={n.href}
                href={n.href}
                className={n.href === pathname ? 'on' : ''}
                aria-current={n.href === pathname ? 'page' : undefined}
              >
                {n.label}
                {n.live && <span className="nb">زنده</span>}
              </AppLink>
            ))}
          </div>
        </div>
      </nav>

      <MobileDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        today={clock.today}
        time={clock.time}
        markets={markets}
        authenticated={Boolean(user)}
      />
    </>
  )
}
