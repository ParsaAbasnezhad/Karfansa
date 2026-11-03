import { useState } from 'react'
import { AppLink } from '@/components/AppLink'
import { formatNumber, timeAgo } from '@/lib/format'
import { URLS } from '@/lib/site'
import type { AnalysisArticle, AnalysisKind } from '@/lib/types'
import { ANALYSIS_TABS, useAnalysis, useAnalysts, useReports } from './data'
import { Icon } from './icons'
import { ErrorBox, SectionHead, Skeleton, Tabs } from './parts'

function ArticleCard({ article }: { article: AnalysisArticle }) {
  return (
    <article className="acard">
      <span className="kick">{article.category}</span>
      <h3>
        <AppLink href={article.url}>{article.title}</AppLink>
      </h3>
      <p>{article.excerpt}</p>
      <div className="by">
        <span>
          <i className="av av-sm">{article.author.charAt(0)}</i>
          {article.author}
        </span>
        <span className="when-note">
          {timeAgo(article.published_at)} · {formatNumber(article.read_minutes)} دقیقه
        </span>
      </div>
    </article>
  )
}

export function AnalysisSection() {
  const [kind, setKind] = useState<AnalysisKind>('all')
  const main = useAnalysis(kind)
  const reports = useReports()
  const analysts = useAnalysts()
  const hero = main.data?.hero

  return (
    <section className="panel sec" id="analysis">
      <SectionHead
        icon="bars"
        title="تحلیل و گزارش"
        sub="تحلیل‌های تخصصی و گزارش‌های کامل از کارشناسان اقتصادی"
      >
        <AppLink className="link" href={URLS.analysisAll}>
          <Icon name="arrow-l" />
          مشاهده همه
        </AppLink>
      </SectionHead>
      <Tabs items={ANALYSIS_TABS} value={kind} onChange={setKind} label="نوع مطلب" />

      <div className="agrid">
        <div className="amain">
          {main.isError && !main.data ? (
            <ErrorBox onRetry={() => void main.refetch()} />
          ) : !hero ? (
            <Skeleton height={430} />
          ) : (
            <>
              <article className="ahero" style={{ backgroundImage: `url(${hero.image})` }}>
                <span className="tag">{hero.tag}</span>
                <h3>
                  <AppLink href={hero.url}>{hero.title}</AppLink>
                </h3>
                <p>{hero.excerpt}</p>
                <div className="by">
                  <span className="av">{hero.author.charAt(0)}</span>
                  <span>{hero.author}</span>
                  <span>· {formatNumber(hero.read_minutes)} دقیقه مطالعه</span>
                </div>
                <AppLink className="btn" href={hero.download_url}>
                  دانلود گزارش کامل
                  <Icon name="arrow-l" />
                </AppLink>
              </article>
              <div className="acards">
                {main.data?.articles.length ? (
                  main.data.articles.map((a) => <ArticleCard key={a.id} article={a} />)
                ) : (
                  <p className="empty-note">مطلبی در این دسته منتشر نشده است.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="aside">
          <div className="box">
            <h4>جدیدترین گزارش‌ها</h4>
            {reports.data ? (
              reports.data.results.map((r) => (
                <AppLink className="rep" href={r.url} key={r.id}>
                  <span className="pdf">
                    PDF<small>{formatNumber(r.pages)} صفحه</small>
                  </span>
                  {r.title}
                </AppLink>
              ))
            ) : (
              <Skeleton height={220} />
            )}
            <AppLink className="more" href={URLS.reportsAll}>
              <Icon name="arrow-l" />
              مشاهده همه گزارش‌ها
            </AppLink>
          </div>
          <div className="box">
            <h4>تحلیلگران</h4>
            {analysts.data ? (
              analysts.data.results.map((p) => (
                <AppLink className="analyst" href={p.url} key={p.id}>
                  <span className="av">{p.name.charAt(0)}</span>
                  <div>
                    <b>{p.name}</b>
                    <small>{p.role}</small>
                  </div>
                </AppLink>
              ))
            ) : (
              <Skeleton height={150} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
