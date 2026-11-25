import type { AnchorHTMLAttributes } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NEWS_SITE_URL } from '@/lib/site'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string }

const loginPath = (href: string) => href.split(/[?#]/)[0].replace(/\/$/, '') === '/login'

const isPlainAnchor = (href: string) =>
  /^(https?:)?\/\//.test(href) ||
  /^(mailto|tel):/.test(href) ||
  href.startsWith('/media/') ||
  href.startsWith('/static/')

/** Internal paths go through React Router; files, media and external URLs stay normal links. */
export function AppLink({ href, children, ...rest }: Props) {
  const location = useLocation()
  if (href === NEWS_SITE_URL) {
    return (
      <a
        href={href}
        {...rest}
        title={rest.title ?? 'باز شدن در برگه جدید'}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    )
  }
  if (isPlainAnchor(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }
  const here = location.pathname.replace(/\/$/, '') || '/'
  return (
    <Link
      to={href}
      {...rest}
      state={loginPath(href) && here !== '/login' ? { backgroundLocation: location } : undefined}
    >
      {children}
    </Link>
  )
}
