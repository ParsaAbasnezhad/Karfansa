import { useState } from 'react'
import { AppLink } from '@/components/AppLink'
import { timeAgo } from '@/lib/format'
import { URLS } from '@/lib/site'
import type { CompanyFilter, CompanyNewsItem } from '@/lib/types'
import { COMPANY_CATEGORIES, COMPANY_TABS, useCompanyNews } from './data'
import { Icon } from './icons'
import { ErrorBox, SectionHead, Skeleton, Tabs } from './parts'

function NewsCard({ item }: { item: CompanyNewsItem }) {
  const category = COMPANY_CATEGORIES[item.category]
  return (
    <article className="ncard">
      <AppLink className="ph" href={item.url} tabIndex={-1} aria-hidden="true">
        <img src={item.image} alt="" loading="lazy" />
        <span className={`badge ${category?.cls ?? ''}`}>{category?.label}</span>
      </AppLink>
      <div className="bd">
        <div className="co">
          <span>{item.company_name.charAt(0)}</span>
          {item.company_name}
        </div>
        <h3>
          <AppLink href={item.url}>{item.title}</AppLink>
        </h3>
        <div className="ft">
          <AppLink href={item.url}>
            <Icon name="arrow-l" />
            ادامه خبر
          </AppLink>
          <span>
            <Icon name="clock" />
            {timeAgo(item.published_at)}
          </span>
        </div>
      </div>
    </article>
  )
}

export function CompanyNews() {
  const [category, setCategory] = useState<CompanyFilter>('all')
  const { data, isError, isPlaceholderData, refetch } = useCompanyNews(category)
  const tabs = COMPANY_TABS.map((t) => ({ ...t, count: data?.counts[t.key] }))

  return (
    <section className="panel sec" id="cnews">
      <SectionHead
        icon="building"
        title="اخبار شرکت‌ها"
        sub="آخرین رویدادها و گزارش‌های شرکت‌ها به تفکیک حوزه فعالیت"
      >
        <AppLink className="link" href={URLS.companyNewsAll}>
          <Icon name="arrow-l" />
          مشاهده همه
        </AppLink>
      </SectionHead>
      <Tabs items={tabs} value={category} onChange={setCategory} label="دسته‌بندی اخبار شرکت‌ها" />
      {isError && !data ? (
        <ErrorBox onRetry={() => void refetch()} />
      ) : (
        <div className="ngrid" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
          {data
            ? data.results.map((n) => <NewsCard key={n.id} item={n} />)
            : Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={300} />)}
        </div>
      )}
      <AppLink className="mobmore" href={URLS.companyNewsAll}>
        <Icon name="arrow-l" />
        مشاهده همه اخبار شرکت‌ها
      </AppLink>
    </section>
  )
}
