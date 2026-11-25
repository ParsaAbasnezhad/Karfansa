import { useQuery } from '@tanstack/react-query'
import { AppLink } from '@/components/AppLink'
import { TradeTypeIcon } from '@/features/trade/TradeArt'
import type { TradeOpportunity, TradeOpportunityPage } from '@/features/trade/types'
import { apiGet } from '@/lib/api-client'
import { formatShortDate } from '@/lib/format'
import { Icon } from './icons'
import './trade-opportunities.css'

const HOME_OPPORTUNITY_COUNT = 6

function OpportunityCard({ opportunity }: { opportunity: TradeOpportunity }) {
  const detailUrl = `/trade/${encodeURIComponent(opportunity.slug)}/`
  const location = [opportunity.province_name_fa, opportunity.city_name_fa]
    .filter(Boolean)
    .join('، ')

  return (
    <article className="home-trade-card" aria-labelledby={`home-trade-title-${opportunity.id}`}>
      <div className="home-trade-card-top">
        <span className="home-trade-type">
          <TradeTypeIcon type={opportunity.opportunity_type} />
          {opportunity.opportunity_type_display}
        </span>
        <span className="home-trade-location">
          <Icon name="pin" />
          {location}
        </span>
      </div>

      <h3 id={`home-trade-title-${opportunity.id}`}>{opportunity.title}</h3>
      <p className="home-trade-description">{opportunity.description}</p>

      {(opportunity.product_name_fa || opportunity.industry_name_fa || opportunity.company) && (
        <dl className="home-trade-facts">
          {opportunity.product_name_fa && (
            <div>
              <dt>محصول</dt>
              <dd>{opportunity.product_name_fa}</dd>
            </div>
          )}
          {opportunity.industry_name_fa && (
            <div>
              <dt>صنعت</dt>
              <dd>{opportunity.industry_name_fa}</dd>
            </div>
          )}
          {opportunity.company && (
            <div>
              <dt>شرکت</dt>
              <dd>{opportunity.company.name}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="home-trade-card-bottom">
        <div className="home-trade-dates">
          {opportunity.published_at && (
            <span>
              انتشار <time dateTime={opportunity.published_at}>{formatShortDate(opportunity.published_at)}</time>
            </span>
          )}
          {opportunity.valid_until && (
            <span>
              اعتبار تا <time dateTime={opportunity.valid_until}>{formatShortDate(opportunity.valid_until)}</time>
            </span>
          )}
        </div>
        <AppLink className="home-trade-detail" href={detailUrl}>
          مشاهده جزئیات
          <Icon name="arrow-l" />
        </AppLink>
      </div>
    </article>
  )
}

export function TradeOpportunitiesSection() {
  const opportunities = useQuery({
    queryKey: ['trade-opportunities', 'home', HOME_OPPORTUNITY_COUNT],
    queryFn: ({ signal }) =>
      apiGet<TradeOpportunityPage>(
        '/v1/trade/opportunities/',
        { ordering: 'newest', page: 1, page_size: HOME_OPPORTUNITY_COUNT },
        signal,
      ),
  })

  return (
    <section className="panel home-trade" id="trade-opportunities" dir="rtl" aria-labelledby="home-trade-heading">
      <header className="home-trade-heading">
        <div>
          <span className="home-trade-eyebrow">کشف فرصت‌های تازه</span>
          <h2 id="home-trade-heading">فرصت‌های تجاری</h2>
          <p>فرصت‌های تأییدشدهٔ خرید، فروش و همکاری را از سراسر ایران بررسی کنید.</p>
        </div>
        <AppLink className="home-trade-all" href="/trade/">
          مشاهده همه فرصت‌های تجاری
          <Icon name="arrow-l" />
        </AppLink>
      </header>

      {opportunities.isPending ? (
        <div className="home-trade-grid" role="status" aria-label="در حال بارگذاری فرصت‌های تجاری">
          {Array.from({ length: HOME_OPPORTUNITY_COUNT }, (_, index) => (
            <div className="home-trade-skeleton" key={index} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : opportunities.isError ? (
        <div className="home-trade-message" role="alert">
          <strong>فرصت‌ها بارگذاری نشدند.</strong>
          <p>لطفاً دوباره تلاش کنید.</p>
          <button type="button" onClick={() => void opportunities.refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : opportunities.data.results.length === 0 ? (
        <div className="home-trade-message" role="status">
          <strong>فعلاً فرصت تجاری فعالی ثبت نشده است.</strong>
          <p>فرصت‌های تأییدشده پس از انتشار در این بخش نمایش داده می‌شوند.</p>
        </div>
      ) : (
        <div className="home-trade-grid">
          {opportunities.data.results.map((item) => (
            <OpportunityCard key={item.id} opportunity={item} />
          ))}
        </div>
      )}
    </section>
  )
}
