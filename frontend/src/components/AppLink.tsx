import type { AnchorHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string }

const isPlainAnchor = (href: string) =>
  /^(https?:)?\/\//.test(href) ||
  /^(mailto|tel):/.test(href) ||
  href.startsWith('/media/') ||
  href.startsWith('/static/')

/** Internal paths go through React Router; files, media and external URLs stay normal links. */
export function AppLink({ href, children, ...rest }: Props) {
  if (isPlainAnchor(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  )
}
