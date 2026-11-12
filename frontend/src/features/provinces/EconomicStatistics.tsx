import { useMemo, useState } from 'react'
import { apiGet } from '@/lib/api-client'
import { formatNumber, formatShortDate } from '@/lib/format'
import { useQuery } from '@tanstack/react-query'
import type { ProvinceStatistic, ProvinceSummary, StatisticIndicator } from './types'

type Props = {
  provinceSlug: string
  provinceName: string
  statistics: ProvinceStatistic[]
}

const periods = [
  { value: 'all', label: 'همهٔ دوره‌ها' },
  { value: 'annual', label: 'سالانه' },
  { value: 'quarterly', label: 'فصلی' },
  { value: 'monthly', label: 'ماهانه' },
]

function formatValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(parsed)
    : value
}

function StatisticTrend({ records }: { records: ProvinceStatistic[] }) {
  const { series, timeline } = useMemo(() => {
    const groups = new Map<string, ProvinceStatistic[]>()
    const datedRecords = records.filter((record) => record.value !== null)
    datedRecords.forEach((record) => {
      const label = record.item_label || record.value_text || 'شاخص'
      groups.set(label, [...(groups.get(label) ?? []), record])
    })
    const dates = [
      ...new Map(
        datedRecords.map((record) => [
          `${record.statistical_year}:${record.period_number ?? 0}`,
          record,
        ]),
      ).values(),
    ].sort(
      (a, b) =>
        a.statistical_year - b.statistical_year || (a.period_number ?? 0) - (b.period_number ?? 0),
    )
    return {
      series: [...groups.entries()].map(([label, points]) => ({
        label,
        points: points.sort(
          (a, b) =>
            a.statistical_year - b.statistical_year ||
            (a.period_number ?? 0) - (b.period_number ?? 0),
        ),
      })),
      timeline: dates,
    }
  }, [records])
  const allValues = series.flatMap(({ points }) => points.map((point) => Number(point.value)))
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = max - min || Math.abs(max) || 1
  const colors = ['#1d4ed8', '#5074e7', '#7b94ec', '#122072', '#9bb7ff']
  const x = (index: number, length: number) => 48 + (index * 560) / Math.max(length - 1, 1)
  const y = (value: number) => 178 - ((value - min) / range) * 145

  if (!allValues.length) {
    return <p className="province-muted">برای این شاخص هنوز مقدار عددی مستند ثبت نشده است.</p>
  }

  return (
    <div className="province-stat-chart-wrap">
      <svg
        className="province-stat-chart"
        viewBox="0 0 640 220"
        role="img"
        aria-label="نمودار روند تغییرات شاخص‌های ثبت‌شده"
      >
        <text x="43" y="29" textAnchor="end" className="province-stat-chart-label">
          {formatValue(String(max))}
        </text>
        <text x="43" y="178" textAnchor="end" className="province-stat-chart-label">
          {formatValue(String(min))}
        </text>
        <line x1="48" y1="178" x2="608" y2="178" className="province-stat-axis" />
        <line x1="48" y1="25" x2="48" y2="178" className="province-stat-axis" />
        {series.map(({ label, points }, seriesIndex) => {
          const color = colors[seriesIndex % colors.length]
          const coordinates = points
            .map((point) => {
              const dateIndex = timeline.findIndex(
                (date) =>
                  date.statistical_year === point.statistical_year &&
                  date.period_number === point.period_number,
              )
              return `${x(dateIndex, timeline.length)},${y(Number(point.value))}`
            })
            .join(' ')
          return (
            <g key={label}>
              {points.length > 1 && (
                <polyline
                  points={coordinates}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {points.map((point) => (
                <circle
                  key={point.id}
                  cx={x(
                    timeline.findIndex(
                      (date) =>
                        date.statistical_year === point.statistical_year &&
                        date.period_number === point.period_number,
                    ),
                    timeline.length,
                  )}
                  cy={y(Number(point.value))}
                  r="5"
                  fill={color}
                >
                  <title>
                    {`${label}، ${formatNumber(point.statistical_year)}: ${formatValue(point.value ?? '')} ${point.unit}`}
                  </title>
                </circle>
              ))}
              {series.length > 1 && (
                <text x="608" y={38 + seriesIndex * 18} textAnchor="end" fill={color}>
                  {label}
                </text>
              )}
            </g>
          )
        })}
        {timeline.map((point, index) => (
          <text
            key={`${point.statistical_year}-${point.period_number}`}
            x={x(index, timeline.length)}
            y="202"
            textAnchor="middle"
            className="province-stat-chart-label"
          >
            {point.period_number === null
              ? formatNumber(point.statistical_year)
              : `${formatNumber(point.statistical_year)}/${formatNumber(point.period_number)}`}
          </text>
        ))}
      </svg>
    </div>
  )
}

function recordPeriodLabel(record: ProvinceStatistic) {
  if (record.period_number === null) return record.period_display
  const prefix = record.period === 'quarterly' ? 'فصل' : 'ماه'
  return `${record.period_display} ${prefix} ${formatNumber(record.period_number)}`
}

export function EconomicStatistics({ provinceSlug, provinceName, statistics }: Props) {
  const [selectedIndicator, setSelectedIndicator] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [comparisonProvince, setComparisonProvince] = useState('')
  const indicators = useQuery({
    queryKey: ['province-statistic-indicators'],
    queryFn: ({ signal }) =>
      apiGet<StatisticIndicator[]>('/v1/geography/statistics/indicators/', undefined, signal),
  })
  const provinces = useQuery({
    queryKey: ['province-comparison-options'],
    queryFn: ({ signal }) =>
      apiGet<ProvinceSummary[]>('/v1/geography/provinces/?country=IR', undefined, signal),
  })
  const activeIndicator =
    selectedIndicator === 'all' ? '' : selectedIndicator || indicators.data?.[0]?.value || ''

  const indicatorRecords = statistics.filter(
    (record) =>
      (!activeIndicator || record.indicator === activeIndicator) &&
      (selectedPeriod === 'all' || record.period === selectedPeriod),
  )
  const years = [...new Set(indicatorRecords.map((record) => record.statistical_year))].sort(
    (a, b) => b - a,
  )
  const visibleRecords =
    selectedYear === 'all'
      ? indicatorRecords
      : indicatorRecords.filter((record) => record.statistical_year === Number(selectedYear))
  const indicator = indicators.data?.find((item) => item.value === activeIndicator)
  const comparison = useQuery({
    queryKey: ['province-statistics-comparison', activeIndicator, selectedYear, selectedPeriod],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        indicator: activeIndicator,
        year: selectedYear,
      })
      if (selectedPeriod !== 'all') params.set('period', selectedPeriod)
      return apiGet<ProvinceStatistic[]>(
        `/v1/geography/statistics/?${params.toString()}`,
        undefined,
        signal,
      )
    },
    enabled: Boolean(comparisonProvince && activeIndicator && selectedYear !== 'all'),
  })
  const comparableRows = useMemo(() => {
    const localRecords = visibleRecords.filter(
      (record) => record.value !== null && record.province_slug === provinceSlug,
    )
    const otherRecords = (comparison.data ?? []).filter(
      (record) => record.province_slug === comparisonProvince && record.value !== null,
    )
    return localRecords.flatMap((record) => {
      const matching = otherRecords.find(
        (candidate) =>
          candidate.value !== null &&
          candidate.unit === record.unit &&
          candidate.period === record.period &&
          candidate.period_number === record.period_number &&
          candidate.item_label === record.item_label,
      )
      return matching ? [{ record, matching }] : []
    })
  }, [comparison.data, comparisonProvince, provinceSlug, visibleRecords])

  return (
    <section className="province-content-card province-economic-statistics">
      <div className="province-section-heading">
        <span className="provinces-eyebrow">داده‌های مستند</span>
        <h2>آمار اقتصادی {provinceName}</h2>
        <p>
          فقط آمار تأییدشده با منبع مشخص نمایش داده می‌شود. در صورت نبود داده، مقداری برآورد یا
          جایگزین نشده است.
        </p>
      </div>

      <div className="province-stat-filters" aria-label="فیلتر آمار اقتصادی">
        <label>
          شاخص
          <select
            aria-label="شاخص آماری"
            value={activeIndicator}
            onChange={(event) => {
              setSelectedIndicator(event.target.value || 'all')
              setSelectedYear('all')
            }}
          >
            <option value="">همهٔ شاخص‌ها</option>
            {(indicators.data ?? []).map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          دوره آماری
          <select
            aria-label="دوره آماری"
            value={selectedPeriod}
            onChange={(event) => {
              setSelectedPeriod(event.target.value)
              setSelectedYear('all')
            }}
          >
            {periods.map((period) => (
              <option value={period.value} key={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          سال آماری
          <select
            aria-label="سال آماری"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
          >
            <option value="all">همهٔ سال‌ها</option>
            {years.map((year) => (
              <option value={year} key={year}>
                {formatNumber(year)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {indicators.isError || provinces.isError ? (
        <p className="province-muted" role="alert">
          دریافت گزینه‌های آمار اقتصادی ناموفق بود.
        </p>
      ) : indicators.isPending || provinces.isPending ? (
        <p className="province-muted">در حال دریافت داده‌های آماری…</p>
      ) : !statistics.length ? (
        <p className="province-muted">
          هنوز دادهٔ اقتصادی تأییدشده‌ای برای این استان ثبت نشده است.
        </p>
      ) : (
        <>
          {(() => {
            const chartGroups = new Map<string, ProvinceStatistic[]>()
            visibleRecords
              .filter((record) => record.value !== null)
              .forEach((record) => {
                const key = `${record.period}:${record.unit}`
                chartGroups.set(key, [...(chartGroups.get(key) ?? []), record])
              })
            return chartGroups.size ? (
              <div className="province-stat-charts">
                {[...chartGroups.entries()].map(([key, records]) => (
                  <div className="province-stat-chart-card" key={key}>
                    <div className="province-stat-heading">
                      <div>
                        <strong>{indicator?.label ?? records[0].indicator_display}</strong>
                        <span>
                          {records[0].period_display} · {records[0].unit}
                        </span>
                      </div>
                      <span>{formatNumber(records.length)} رکورد</span>
                    </div>
                    <StatisticTrend records={records} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="province-stat-chart-card">
                <StatisticTrend records={visibleRecords} />
              </div>
            )
          })()}

          <div className="province-stat-comparison">
            <div className="province-stat-heading">
              <div>
                <strong>مقایسه با استان دیگر</strong>
                <span>مقایسه فقط با واحد، سال و دورهٔ آماری یکسان</span>
              </div>
              <label>
                استان برای مقایسه
                <select
                  aria-label="استان برای مقایسه"
                  value={comparisonProvince}
                  onChange={(event) => setComparisonProvince(event.target.value)}
                >
                  <option value="">انتخاب استان</option>
                  {(provinces.data ?? [])
                    .filter((province) => province.is_published && province.slug !== provinceSlug)
                    .map((province) => (
                      <option value={province.slug} key={province.slug}>
                        {province.name_fa}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {!comparisonProvince ? (
              <p className="province-muted">
                برای مقایسه، سال آماری و استان موردنظر را انتخاب کنید.
              </p>
            ) : selectedYear === 'all' ? (
              <p className="province-muted">برای مقایسه، یک سال آماری مشخص انتخاب کنید.</p>
            ) : comparison.isPending ? (
              <p className="province-muted">در حال دریافت داده‌های مقایسه…</p>
            ) : comparison.isError ? (
              <p className="province-muted" role="alert">
                دریافت داده‌های مقایسه ناموفق بود.
              </p>
            ) : comparableRows.length ? (
              <div className="province-stat-table-wrap">
                <table className="province-stat-table">
                  <thead>
                    <tr>
                      <th>شاخص / دوره</th>
                      <th>{provinceName}</th>
                      <th>
                        {(provinces.data ?? []).find(
                          (province) => province.slug === comparisonProvince,
                        )?.name_fa ?? ''}
                      </th>
                      <th>واحد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparableRows.map(({ record, matching }) => (
                      <tr key={`${record.id}-${matching.id}`}>
                        <th>
                          {record.item_label || record.indicator_display}
                          <small>
                            {formatNumber(record.statistical_year)} · {recordPeriodLabel(record)}
                          </small>
                        </th>
                        <td>{formatValue(record.value ?? '')}</td>
                        <td>{formatValue(matching.value ?? '')}</td>
                        <td>{record.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="province-muted">
                دادهٔ هم‌واحد و هم‌دوره برای دو استان ثبت نشده است؛ مقایسه انجام نشد.
              </p>
            )}
          </div>

          <div className="province-stat-records">
            <h3>داده‌ها و منابع رسمی</h3>
            {visibleRecords.length ? (
              <div className="province-stat-record-grid">
                {visibleRecords.map((record) => (
                  <article className="province-stat-record" key={record.id}>
                    <div className="province-stat-record-heading">
                      <strong>{record.item_label || record.indicator_display}</strong>
                      <span>
                        {formatNumber(record.statistical_year)} · {recordPeriodLabel(record)}
                      </span>
                    </div>
                    <p>
                      {record.value !== null
                        ? `${formatValue(record.value)} ${record.unit}`
                        : record.value_text || record.item_label}
                    </p>
                    {record.notes && <small>{record.notes}</small>}
                    <footer>
                      <span>{record.source}</span>
                      {record.source_url && (
                        <a href={record.source_url} target="_blank" rel="noreferrer">
                          مشاهدهٔ منبع
                        </a>
                      )}
                    </footer>
                    <small>
                      {record.source_published_at &&
                        `انتشار منبع: ${formatShortDate(record.source_published_at)}`}
                      {record.collected_at && ` · دریافت: ${formatShortDate(record.collected_at)}`}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="province-muted">برای فیلتر انتخاب‌شده آماری ثبت نشده است.</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
