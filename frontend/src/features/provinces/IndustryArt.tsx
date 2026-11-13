import type { ReactElement } from 'react'

/* تصویرهای خط‌طرح ساده برای صفحه‌ی صنایع (SVG درون‌خطی) */

export function IndustryHeroArt() {
  return (
    <svg
      className="industries-art-svg"
      viewBox="0 0 220 150"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="نمادی از صنعت، تولید و رشد"
    >
      <path d="M14 134h192" stroke="#c9d7ff" strokeWidth="1.5" />
      {/* کارخانه */}
      <path d="M30 134V74l30 18V74l30 18V74l30 18v42" stroke="#e8eeff" strokeWidth="2" />
      <path d="M30 134h90" stroke="#e8eeff" strokeWidth="2" />
      <rect
        x="46"
        y="108"
        width="12"
        height="14"
        rx="2"
        stroke="#dbe5ff"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <rect
        x="72"
        y="108"
        width="12"
        height="14"
        rx="2"
        stroke="#dbe5ff"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <rect
        x="98"
        y="108"
        width="12"
        height="14"
        rx="2"
        stroke="#dbe5ff"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {/* دودکش‌ها */}
      <path d="M40 74V46h12v28M96 74V54h12v20" stroke="#dbe5ff" strokeWidth="2" />
      <path
        d="M46 38c-4-6 4-8 0-14M102 46c-4-6 4-8 0-14"
        stroke="#dbe5ff"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {/* چرخ‌دنده */}
      <g transform="translate(160 62)" stroke="#dbe5ff" strokeWidth="2">
        <circle r="10" />
        <circle r="26" strokeOpacity="0.75" />
        <path d="M0 -34v8M0 26v8M-34 0h8M26 0h8M-24 -24l6 6M18 18l6 6M-24 24l6 -6M18 -18l6 -6" />
      </g>
      {/* پیکان مزیت رقابتی */}
      <path d="M140 128l22-26 16 12 24-34" stroke="#c99a3b" strokeWidth="2.5" />
      <path d="M190 80h12v12" stroke="#c99a3b" strokeWidth="2.5" />
    </svg>
  )
}

export function IndustryAdvantageIcon() {
  return (
    <svg
      className="industry-advantage-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
    </svg>
  )
}

const categoryIcons: Record<string, ReactElement> = {
  agriculture: (
    <>
      <path d="M12 21V10" />
      <path d="M12 14c-4 0-6-2-6-6 4 0 6 2 6 6z" />
      <path d="M12 11c0-3 2-5 6-5 0 4-2 6-6 5z" />
    </>
  ),
  food: (
    <>
      <path d="M4 12h16a8 8 0 0 1-16 0z" />
      <path d="M8 8c0-2 1-2 1-4M12 8c0-2 1-2 1-4M16 8c0-2 1-2 1-4" />
    </>
  ),
  energy: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  mining: (
    <>
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20" />
    </>
  ),
  metals: (
    <>
      <path d="M3 18l3-8h12l3 8z" />
      <path d="M7 10l2-5h6l2 5" />
    </>
  ),
  textiles: <path d="M8 3L3 7l3 3 2-1v12h8V9l2 1 3-3-5-4a4 4 0 0 1-8 0z" />,
  chemicals: (
    <>
      <path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3" />
      <path d="M8 15h8" />
    </>
  ),
  construction: (
    <>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-6h6v6M8 10h2M14 10h2" />
    </>
  ),
  'livestock-fisheries': (
    <>
      <path d="M3 12c4-6 10-6 14 0-4 6-10 6-14 0z" />
      <path d="M17 12l4-4v8z" />
    </>
  ),
  handicrafts: (
    <>
      <path d="M9 3h6M10 3v3c-4 2-5 5-5 8a7 7 0 0 0 14 0c0-3-1-6-5-8V3" />
      <path d="M8 14h8" />
    </>
  ),
  technology: (
    <>
      <path d="M7 7h10v10H7zM10 10h4v4h-4z" />
      <path d="M3 9h4M3 15h4M17 9h4M17 15h4M9 3v4M15 3v4M9 17v4M15 17v4" />
    </>
  ),
}

const gear = (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </>
)

export function IndustryCategoryIcon({ category }: { category?: string }) {
  return (
    <svg
      className="industry-category-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(category && categoryIcons[category]) || gear}
    </svg>
  )
}

export function IndustryEmptyArt() {
  return (
    <svg
      className="industries-empty-art"
      viewBox="0 0 120 90"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 76V40l20 12V40l20 12V40l20 12v24z" strokeOpacity="0.55" />
      <path d="M14 76h60" strokeOpacity="0.55" />
      <circle cx="84" cy="38" r="15" fill="#fff" />
      <path d="M95 49l14 14" strokeWidth="4" />
    </svg>
  )
}
