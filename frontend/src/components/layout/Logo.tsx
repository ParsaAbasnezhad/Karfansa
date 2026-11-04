import { Link } from 'react-router-dom'
import { SITE } from '@/lib/site'

interface Props {
  variant?: 'header' | 'footer'
}

export function Logo({ variant = 'header' }: Props) {
  if (variant === 'footer') {
    return (
      <Link className="flogo" to="/" aria-label={SITE.name}>
        <img src="/KARFANSA%20%E2%80%94%20Logo.svg" alt="" />
      </Link>
    )
  }
  return (
    <Link className="logo" to="/" aria-label={SITE.name}>
      <img src="/KARFANSA%20%E2%80%94%20Logo.svg" alt="" />
    </Link>
  )
}
