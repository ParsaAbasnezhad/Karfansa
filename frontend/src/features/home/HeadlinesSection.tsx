import { AppLink } from '@/components/AppLink'
import { formatClock, whenLabel } from '@/lib/format'
import { URLS } from '@/lib/site'
import { useHeadlines } from './data'
import { Icon } from './icons'
import { ErrorBox, SectionHead, Skeleton } from './parts'

/** Featured story, latest headlines and most-read list. */
export function HeadlinesSection() {
  const { data, isError, refetch } = useHeadlines()

  return (
    <section className="panel sec" id="headlines">
      <SectionHead
        icon="bolt"
        title="تیتر اخبار مهم ایران"
        sub="مهم‌ترین رویدادهای اقتصادی کشور در یک نگاه"
      >
        <AppLink className="link" href={URLS.archive}>
          <Icon name="arrow-l" />
          آرشیو اخبار
        </AppLink>
      </SectionHead>
      {isError && !data ? (
        <ErrorBox onRetry={() => void refetch()} />
      ) : !data ? (
        <Skeleton height={420} />
      ) : (
        <div className="hgrid">
          <article className="feat">
            <AppLink className="ph" href={data.featured.url} style={{ display: 'block' }}>
              <img src={data.featured.image} alt="" />
              {data.featured.is_important && <span className="imp">مهم</span>}
            </AppLink>
            <div className="kick" style={{ marginTop: 16 }}>
              {data.featured.category}
            </div>
            <h3>
              <AppLink href={data.featured.url}>{data.featured.title}</AppLink>
            </h3>
            <p>{data.featured.excerpt}</p>
            <div className="when">
              <Icon name="clock" />
              {whenLabel(data.featured.published_at)}
            </div>
            <div className="minis">
              {data.minis.map((m) => (
                <AppLink className="mini" href={m.url} key={m.id}>
                  <img src={m.image} alt="" />
                  <div>
                    <span className="kick">{m.category}</span>
                    <b>{m.title}</b>
                  </div>
                </AppLink>
              ))}
            </div>
          </article>

          <div className="latest">
            <h4>آخرین تیترها</h4>
            <ul>
              {data.latest.map((l) => (
                <li key={l.id}>
                  <span className="kick">{l.category}</span>
                  <time dateTime={l.published_at}>{formatClock(l.published_at)}</time>
                  <b>
                    <AppLink href={l.url}>{l.title}</AppLink>
                  </b>
                </li>
              ))}
            </ul>
          </div>

          <aside className="pop">
            <h4>پربازدیدترین‌ها</h4>
            <ol>
              {data.popular.map((p) => (
                <li key={p.id}>
                  <AppLink href={p.url}>{p.title}</AppLink>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </section>
  )
}
