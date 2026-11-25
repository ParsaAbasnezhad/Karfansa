import type { ReactNode, SVGProps } from 'react'

export type BusinessIconName =
  | 'activity'
  | 'analytics'
  | 'arrow-left'
  | 'arrow-up-left'
  | 'bell'
  | 'briefcase'
  | 'building'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'clock'
  | 'close'
  | 'document'
  | 'edit'
  | 'external'
  | 'eye'
  | 'grid'
  | 'inbox'
  | 'menu'
  | 'message'
  | 'package'
  | 'plus'
  | 'search'
  | 'settings'
  | 'shield'
  | 'spark'
  | 'trade'
  | 'user'
  | 'users'
  | 'warning'

type Props = SVGProps<SVGSVGElement> & { name: BusinessIconName; size?: number }

const iconPaths: Record<BusinessIconName, ReactNode> = {
  activity: (
    <>
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V10m5 10V4m5 16v-7m5 7V8" />
      <path d="M2 20h20" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M20 12H4m7-7-7 7 7 7" />
    </>
  ),
  'arrow-up-left': (
    <>
      <path d="M18 18 6 6m0 9V6h9" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9Zm-8 12h4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18m-11-1h4v3h-4z" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 21v-4h6v4M8 7h2m4 0h2M8 11h2m4 0h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18" />
    </>
  ),
  check: (
    <>
      <path d="m4 12 5 5L20 6" />
    </>
  ),
  'chevron-down': (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ),
  'chevron-left': (
    <>
      <path d="m15 5-7 7 7 7" />
    </>
  ),
  'chevron-right': (
    <>
      <path d="m9 5 7 7-7 7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: (
    <>
      <path d="M5 5 19 19M19 5 5 19" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h4M8 12h6m-6 4h8" />
    </>
  ),
  edit: (
    <>
      <path d="m15 5 4 4M4 20l4.5-.8L20 7.7 16.3 4 4.8 15.5 4 20Z" />
    </>
  ),
  external: (
    <>
      <path d="M13 4h7v7m0-7-9 9" />
      <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 5h16l2 11v4H2v-4L4 5Z" />
      <path d="M2 16h6l2 3h4l2-3h6" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  message: (
    <>
      <path d="M20 16a3 3 0 0 1-3 3H9l-5 3v-3a3 3 0 0 1-2-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10Z" />
      <path d="M7 9h8m-8 4h6" />
    </>
  ),
  package: (
    <>
      <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" />
      <path d="m3 7 9 5 9-5M12 12v10m-4.5-17.5 9 5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  settings: (
    <>
      <path d="M10 2h4l.7 2.1 1.7.7 2-.9 2.8 2.8-.9 2 .7 1.7 2.1.7v4l-2.1.7-.7 1.7.9 2-2.8 2.8-2-.9-1.7.7L14 23h-4l-.7-2.1-1.7-.7-2 .9-2.8-2.8.9-2-.7-1.7L1 14v-4l2.1-.7.7-1.7-.9-2 2.8-2.8 2 .9 1.7-.7L10 2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7 14 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    </>
  ),
  trade: (
    <>
      <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5" />
    </>
  ),
  warning: (
    <>
      <path d="m12 3 10 18H2L12 3Z" />
      <path d="M12 9v5m0 4h.01" />
    </>
  ),
}

export function BusinessIcon({ name, size = 20, strokeWidth = 1.8, ...props }: Props) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {iconPaths[name]}
    </svg>
  )
}
