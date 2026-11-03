import { Link } from 'react-router-dom'
import logoMark from '@/assets/logo-mark.png'
import { SITE } from '@/lib/site'

interface Props {
  variant?: 'header' | 'footer'
  showTagline?: boolean
}

export function Logo({ variant = 'header', showTagline = true }: Props) {
  if (variant === 'footer') {
    return (
      <Link className="flogo" to="/" aria-label={SITE.name}>
        <img src={logoMark} alt="" />
        <b>{SITE.latin}</b>
      </Link>
    )
  }
  return (
    <Link className="logo" to="/" aria-label={SITE.name}>
      <img src={logoMark} alt="" />
      <span className="lt">
        <b>{SITE.latin}</b>
        {showTagline && (
          <small>
            {SITE.name} · {SITE.tagline}
          </small>
        )}
      </span>
    </Link>
  )
}
