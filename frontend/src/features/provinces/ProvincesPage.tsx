import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import type { ProvinceSummary } from './types'
import provinceMap from './iran-provinces-map.json'
import './provinces.css'

const mapLabelOffsets: Record<string, [number, number]> = {
  'west-azerbaijan': [-25, 4],
  'east-azerbaijan': [30, -22],
  ardabil: [40, 8],
  'north-khorasan': [12, -9],
  'razavi-khorasan': [18, 8],
  gilan: [16, -12],
  zanjan: [4, -15],
  mazandaran: [20, -14],
  golestan: [7, -13],
  alborz: [18, -15],
  tehran: [23, 12],
  qom: [24, 19],
  markazi: [-17, 16],
  hamadan: [0, 15],
  kurdistan: [-20, -1],
  kermanshah: [-5, 16],
  ilam: [-18, 18],
}

export function ProvincesPage() {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'استان‌های ایران | کارفنسا'
  }, [])

  const provinces = useQuery({
    queryKey: ['iran-province-directory'],
    queryFn: ({ signal }) =>
      apiGet<ProvinceSummary[]>('/v1/geography/provinces/', { country: 'IR' }, signal),
  })
  const published = provinces.data?.filter((province) => province.is_published) ?? []

  return (
    <div className="provinces-page" dir="rtl">
      <header className="provinces-hero">
        <div className="provinces-hero-copy">
          <span className="provinces-eyebrow">شناخت سرزمین ایران</span>
          <h1>هر استان، دنیایی از فرصت</h1>
          <p>جغرافیا، شهرها و ظرفیت‌های اقتصادی استان‌های ایران را یک‌جا کشف کنید.</p>
          {!provinces.isPending && !provinces.isError && (
            <div className="provinces-hero-meta">
              <span className="provinces-hero-count">{formatPersianNumber(published.length)}</span>
              <span>استان برای شناختن</span>
            </div>
          )}
        </div>
        <div className="provinces-hero-art" aria-hidden="true">
          <span className="provinces-hero-orbit provinces-hero-orbit-one" />
          <span className="provinces-hero-orbit provinces-hero-orbit-two" />
          <span className="provinces-hero-pin">ایران</span>
        </div>
      </header>

      {provinces.isPending ? (
        <p className="provinces-state">در حال دریافت فهرست استان‌ها…</p>
      ) : provinces.isError ? (
        <div className="provinces-state" role="alert">
          دریافت فهرست استان‌ها ممکن نشد.
          <button type="button" onClick={() => void provinces.refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : published.length ? (
        <section className="iran-map-section" aria-label="نقشه و فهرست استان‌های ایران">
          <div className="iran-map-panel">
            <div className="iran-map-heading">
              <div>
                <span className="provinces-eyebrow">نقشهٔ تعاملی ایران</span>
                <h2>برای دیدن هر استان، روی نقشه بزنید</h2>
              </div>
              <span className="iran-map-total">{formatPersianNumber(published.length)} استان</span>
            </div>
            <div className="iran-map-canvas">
              <svg
                className="iran-map-svg"
                viewBox="0 0 640 570"
                role="group"
                aria-label="نقشهٔ تعاملی استان‌های ایران"
                onPointerLeave={() => setHoveredSlug(null)}
              >
                <defs>
                  <linearGradient id="iran-map-fill" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#dbe5ff" />
                    <stop offset="100%" stopColor="#9bb7ff" />
                  </linearGradient>
                  <linearGradient id="iran-map-active" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#9bb7ff" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                  <filter id="iran-map-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow
                      dx="0"
                      dy="2"
                      stdDeviation="2.5"
                      floodColor="#1d4ed8"
                      floodOpacity=".14"
                    />
                  </filter>
                </defs>
                <g className="iran-map-regions">
                  {provinceMap.provinces.map((region) => {
                    const province = published.find((item) => item.slug === region.slug)
                    if (!province) return null
                    const isHovered = hoveredSlug === province.slug
                    return (
                      <Link
                        key={region.slug}
                        className={`iran-map-link${isHovered ? ' is-hovered' : ''}`}
                        to={`/provinces/${province.slug}/`}
                        aria-label={`مشاهدهٔ استان ${province.name_fa}`}
                        onPointerEnter={() => setHoveredSlug(province.slug)}
                        onFocus={() => setHoveredSlug(province.slug)}
                        onBlur={() => setHoveredSlug(null)}
                      >
                        <path
                          className="iran-map-region"
                          d={region.path}
                          fill={isHovered ? 'url(#iran-map-active)' : 'url(#iran-map-fill)'}
                          filter="url(#iran-map-shadow)"
                        >
                          <title>{province.name_fa}</title>
                        </path>
                      </Link>
                    )
                  })}
                </g>
                <g className="iran-map-labels">
                  {provinceMap.provinces.map((region) => {
                    const province = published.find((item) => item.slug === region.slug)
                    if (!province) return null
                    const width = Math.max(42, province.name_fa.length * 7.2 + 16)
                    const isHovered = hoveredSlug === province.slug
                    const [offsetX, offsetY] = mapLabelOffsets[region.slug] ?? [0, 0]
                    return (
                      <Link
                        key={region.slug}
                        className={`iran-map-label${isHovered ? ' is-hovered' : ''}`}
                        to={`/provinces/${province.slug}/`}
                        aria-label={`مشاهدهٔ استان ${province.name_fa}`}
                        onPointerEnter={() => setHoveredSlug(province.slug)}
                        onFocus={() => setHoveredSlug(province.slug)}
                        onBlur={() => setHoveredSlug(null)}
                      >
                        <g transform={`translate(${region.x} ${region.y})`}>
                          {(offsetX !== 0 || offsetY !== 0) && (
                            <line
                              className="iran-map-label-leader"
                              x1="0"
                              y1="0"
                              x2={offsetX * 0.62}
                              y2={offsetY * 0.62}
                            />
                          )}
                          <rect
                            x={offsetX - width / 2}
                            y={offsetY - 10}
                            width={width}
                            height="20"
                            rx="7"
                            className="iran-map-label-bg"
                          />
                          <text
                            className="iran-map-label-text"
                            textAnchor="middle"
                            x={offsetX}
                            y={offsetY + 4}
                          >
                            {province.name_fa}
                          </text>
                        </g>
                      </Link>
                    )
                  })}
                </g>
              </svg>
            </div>
            <footer className="iran-map-attribution">
              <span>برای بازشدن صفحهٔ استان، ناحیه یا نام آن را انتخاب کنید.</span>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                © مشارکت‌کنندگان OpenStreetMap
              </a>
            </footer>
          </div>
          <aside className="iran-province-directory" aria-label="فهرست استان‌ها">
            <div className="iran-directory-heading">
              <span className="provinces-eyebrow">استان‌های ایران</span>
              <h2>
                {hoveredSlug
                  ? published.find((province) => province.slug === hoveredSlug)?.name_fa
                  : 'یک مقصد انتخاب کنید'}
              </h2>
              <p>
                {hoveredSlug
                  ? 'برای ورود به صفحهٔ معرفی استان کلیک کنید.'
                  : 'نام هر استان را انتخاب کنید یا از روی نقشه وارد شوید.'}
              </p>
            </div>
            <nav className="iran-directory-list">
              {published.map((province, index) => (
                <Link
                  className={`iran-directory-link${hoveredSlug === province.slug ? ' is-hovered' : ''}`}
                  key={province.id}
                  to={`/provinces/${province.slug}/`}
                  onPointerEnter={() => setHoveredSlug(province.slug)}
                  onPointerLeave={() => setHoveredSlug(null)}
                  onFocus={() => setHoveredSlug(province.slug)}
                  onBlur={() => setHoveredSlug(null)}
                >
                  <span>{formatPersianNumber(index + 1)}</span>
                  <strong>{province.name_fa}</strong>
                  <i aria-hidden="true">←</i>
                </Link>
              ))}
            </nav>
            <a
              className="iran-map-all-link"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              دربارهٔ داده‌های نقشه <span aria-hidden="true">↗</span>
            </a>
          </aside>
        </section>
      ) : (
        <p className="provinces-state">هنوز استان منتشرشده‌ای در دسترس نیست.</p>
      )}
    </div>
  )
}

function formatPersianNumber(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value)
}
