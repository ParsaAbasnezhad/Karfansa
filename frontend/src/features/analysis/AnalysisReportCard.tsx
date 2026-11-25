import { Link } from 'react-router-dom'
import { Icon } from '@/features/home/icons'
import { formatNumber } from '@/lib/format'
import { ANALYSIS_REPORT_TYPES, formatAnalysisDate } from './api'
import type { AnalysisReport } from './types'

export function AnalysisReportCard({ report }: { report: AnalysisReport }) {
  return (
    <article className="analysis-card">
      <Link
        className="analysis-card-cover"
        to={`/analysis/${encodeURIComponent(report.slug)}`}
        aria-label={`مطالعه ${report.title}`}
      >
        {report.cover_image ? (
          <img src={report.cover_image} alt="" loading="lazy" />
        ) : (
          <span className="analysis-card-cover-fallback" aria-hidden="true">
            <Icon name="bars" />
          </span>
        )}
        {report.category && <span className="analysis-category">{report.category.name}</span>}
      </Link>
      <div className="analysis-card-body">
        <span className="analysis-type">
          {ANALYSIS_REPORT_TYPES.find((item) => item.value === report.report_type)?.label ||
            'تحلیل اقتصادی'}
        </span>
        <h3>
          <Link to={`/analysis/${encodeURIComponent(report.slug)}`}>{report.title}</Link>
        </h3>
        <p>{report.short_description}</p>
        <div className="analysis-card-meta">
          <span>
            <Icon name="user" />
            {report.author?.full_name || 'تحریریه کارفنسا'}
          </span>
          <span>{formatAnalysisDate(report.published_at)}</span>
        </div>
        <div className="analysis-card-footer">
          <span>{formatNumber(report.reading_minutes)} دقیقه مطالعه</span>
          <Link to={`/analysis/${encodeURIComponent(report.slug)}`}>
            مشاهده تحلیل
            <Icon name="arrow-l" />
          </Link>
        </div>
      </div>
    </article>
  )
}
