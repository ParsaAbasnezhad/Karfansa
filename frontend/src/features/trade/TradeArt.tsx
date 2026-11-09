import type { ReactElement } from 'react'
import type { TradeOpportunityType } from './types'

/* تصویرهای خط‌طرح ساده (SVG درون‌خطی) با نماد تجارت و اقتصاد */

export function TradeHeroArt() {
  return (
    <svg
      className="trade-art-svg"
      viewBox="0 0 220 150"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="نمادی از تجارت جهانی و رشد اقتصادی"
    >
      {/* کره زمین */}
      <circle cx="146" cy="48" r="38" stroke="#005a9c" strokeWidth="2" />
      <ellipse
        cx="146"
        cy="48"
        rx="15"
        ry="38"
        stroke="#005a9c"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <path
        d="M108 48h76M115 30h62M115 66h62"
        stroke="#005a9c"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      {/* نمودار رشد */}
      <path d="M16 128h188" stroke="#9cc7e0" strokeWidth="1.5" />
      <rect x="22" y="104" width="16" height="24" rx="3" stroke="#005a9c" strokeWidth="2" />
      <rect x="46" y="88" width="16" height="40" rx="3" stroke="#005a9c" strokeWidth="2" />
      <rect x="70" y="70" width="16" height="58" rx="3" stroke="#005a9c" strokeWidth="2" />
      <path d="M22 92l26-18 22-4 40-36" stroke="#c99a3b" strokeWidth="2.5" />
      <path d="M100 28l10 6-8 8" stroke="#c99a3b" strokeWidth="2.5" />
      {/* کشتی */}
      <path d="M118 128l-4-12h54l-4 12" stroke="#005a9c" strokeWidth="2" />
      <rect
        x="126"
        y="104"
        width="14"
        height="12"
        rx="2"
        stroke="#005a9c"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <rect
        x="144"
        y="104"
        width="14"
        height="12"
        rx="2"
        stroke="#005a9c"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function TradeCtaArt() {
  return (
    <svg
      className="trade-cta-art"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="26" width="48" height="26" rx="4" />
      <path d="M22 26v-6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6M8 38h48M28 38v4h8v-4" />
    </svg>
  )
}

export function TradeEmptyArt() {
  return (
    <svg
      className="trade-empty-art"
      viewBox="0 0 120 90"
      fill="none"
      stroke="#005a9c"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 34l30-14 30 14v32L48 80 18 66z" strokeOpacity="0.55" />
      <path d="M18 34l30 14 30-14M48 48v32" strokeOpacity="0.55" />
      <circle cx="84" cy="40" r="16" fill="#fff" />
      <path d="M96 52l14 14" strokeWidth="4" />
    </svg>
  )
}

const icons: Record<TradeOpportunityType, ReactElement> = {
  export: (
    <>
      <path d="M3 16l1.5 4h15L21 16z" />
      <path d="M6 16v-5h12v5M9 11V8h6v3M12 8V5" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v10M8 9l4 4 4-4" />
      <path d="M4 15v4h16v-4" />
    </>
  ),
  'raw-materials': (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  'bulk-buy': (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 11h11L21 8H6.5" />
    </>
  ),
  'bulk-sell': (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.3" />
    </>
  ),
  partnership: (
    <>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </>
  ),
  investment: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
}

export function TradeTypeIcon({ type }: { type: TradeOpportunityType }) {
  return (
    <svg
      className="trade-type-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[type] ?? icons.export}
    </svg>
  )
}
