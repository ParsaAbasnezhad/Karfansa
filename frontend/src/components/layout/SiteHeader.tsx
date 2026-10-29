import { Link } from 'react-router-dom'
import { StatusChip } from '@/features/system/StatusChip'

function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="کارفنسا، صفحه‌ی اصلی">
      <svg className="wordmark__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M10 8c1 5 1 11 6 16M16 7v17M22 8c-1 5-1 11-6 16"
          fill="none"
          stroke="var(--saffron)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      کارفنسا
    </Link>
  )
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Wordmark />
        <nav className="site-nav" aria-label="بخش‌های صفحه">
          <a href="/#how">چطور کار می‌کند</a>
          <a href="/#audiences">برای چه کسانی</a>
        </nav>
        <StatusChip />
      </div>
    </header>
  )
}
