import { Link } from 'react-router-dom'
import provinceMap from './iran-provinces-map.json'
import type { ProvinceDetail, ProvinceSummary } from './types'

type Props = {
  provinces: ProvinceSummary[]
  hoveredSlug: string | null
  selectedSlug: string | null
  activeSlug: string | null
  selectedDetail?: ProvinceDetail
  organizationCount?: number
  opportunityCount?: number
  onHover: (slug: string | null) => void
}

const numberFormat = new Intl.NumberFormat('fa-IR')

export function IranMapPanel({
  provinces,
  hoveredSlug,
  selectedSlug,
  activeSlug,
  selectedDetail,
  organizationCount,
  opportunityCount,
  onHover,
}: Props) {
  const provinceBySlug = new Map(provinces.map((province) => [province.slug, province]))
  const activeProvince = activeSlug ? provinceBySlug.get(activeSlug) : undefined
  const showSelectedStats = activeSlug === selectedSlug && Boolean(selectedDetail)

  return (
    <div className="iran-map-panel">
      <header className="iran-map-heading">
        <div>
          <span className="provinces-eyebrow">نقشهٔ ظرفیت‌های منطقه‌ای</span>
          <h2>ایران، در یک نگاه</h2>
        </div>
        <span className="iran-map-total">{numberFormat.format(provinces.length)} استان</span>
      </header>

      <div className="iran-map-canvas">
        <svg
          className="iran-map-svg"
          viewBox="0 0 640 570"
          role="group"
          aria-label="نقشهٔ تعاملی استان‌های ایران"
          onPointerLeave={() => onHover(null)}
        >
          <defs>
            <pattern id="iran-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#90a5bb" strokeOpacity=".13" />
            </pattern>
          </defs>
          <rect className="iran-map-grid" x="0" y="0" width="640" height="570" />
          <g className="iran-map-regions">
            {provinceMap.provinces.map((region) => {
              const province = provinceBySlug.get(region.slug)
              if (!province) return null
              const isSelected = selectedSlug === region.slug
              const isActive = hoveredSlug === region.slug
              return (
                <Link
                  key={region.slug}
                  className={`iran-map-link${isActive ? ' is-hovered' : ''}${isSelected ? ' is-selected' : ''}`}
                  to={`/provinces/${province.slug}/`}
                  aria-label={`مشاهدهٔ استان ${province.name_fa}`}
                  onPointerEnter={() => onHover(province.slug)}
                  onFocus={() => onHover(province.slug)}
                  onBlur={() => onHover(null)}
                >
                  <path className="iran-map-region" d={region.path}>
                    <title>{province.name_fa}</title>
                  </path>
                </Link>
              )
            })}
          </g>
          <g className="iran-map-active-label" aria-hidden="true">
            {activeProvince &&
              provinceMap.provinces
                .filter((region) => region.slug === activeProvince.slug)
                .map((region) => (
                  <text key={region.slug} x={region.x} y={region.y + 3} textAnchor="middle">
                    {activeProvince.name_fa}
                  </text>
                ))}
          </g>
        </svg>

        {activeProvince && (
          <div className="iran-map-tooltip" role="status" aria-live="polite">
            <span className="iran-map-tooltip-kicker">
              {showSelectedStats ? 'نمای داده‌های استان' : 'استان منتخب روی نقشه'}
            </span>
            <strong>{activeProvince.name_fa}</strong>
            {showSelectedStats && (
              <dl>
                {organizationCount !== undefined && (
                  <div>
                    <dt>کسب‌وکار فعال</dt>
                    <dd>{numberFormat.format(organizationCount)}</dd>
                  </div>
                )}
                {opportunityCount !== undefined && (
                  <div>
                    <dt>فرصت تجاری</dt>
                    <dd>{numberFormat.format(opportunityCount)}</dd>
                  </div>
                )}
                {!!selectedDetail?.statistics.length && (
                  <div>
                    <dt>شاخص اقتصادی ثبت‌شده</dt>
                    <dd>{numberFormat.format(selectedDetail.statistics.length)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}
      </div>

      <footer className="iran-map-footer">
        <div className="iran-map-legend">
          <span>
            <i className="is-default" /> محدودهٔ استان
          </span>
          <span>
            <i className="is-hovered" /> استان منتخب
          </span>
        </div>
        <a
          className="iran-map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © داده‌های جغرافیایی OpenStreetMap
        </a>
      </footer>
    </div>
  )
}
