import { AppLink } from '@/components/AppLink'
import { formatClock, whenLabel } from '@/lib/format'
import { URLS } from '@/lib/site'
import { useHeadlines } from './data'
import { Icon } from './icons'
import { ErrorBox, SectionHead, Skeleton } from './parts'

/** Featured story and latest approved RSS headlines. */
export function HeadlinesSection() {
  const { data, isError, refetch } = useHeadlines()

  return (
    <section className="panel sec" id="headlines">
      <SectionHead
        icon="bolt"
        title="تیتر اخبار مهم ایران"
        sub="مهم‌ترین رویدادهای اقتصادی کشور در یک نگاه"
      >
        <AppLink className="link" href={URLS.allNews}>
          <Icon name="arrow-l" />
          همهٔ خبرها
        </AppLink>
      </SectionHead>
      {isError && !data ? (
        <ErrorBox onRetry={() => void refetch()} />
      ) : !data ? (
        <Skeleton height={420} />
      ) : data.featured ? (
        <div className="hgrid">
          <article className="feat">
            <a
              className={'ph' + (!data.featured.image_url ? ' ph-empty' : '')}
              href={data.featured.original_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block' }}
            >
              {data.featured.image_url ? (
                <img src={data.featured.image_url} alt="" />
              ) : (
                <Icon name="news" />
              )}
              <span className="imp">مهم</span>
            </a>
            <div className="kick" style={{ marginTop: 16 }}>
              {data.featured.topic}
            </div>
            <h3>
              <a href={data.featured.original_url} target="_blank" rel="noopener noreferrer">
                {data.featured.title}
              </a>
            </h3>
            <p>{data.featured.summary}</p>
            <div className="when">
              <Icon name="clock" />
              {whenLabel(data.featured.published_at ?? data.featured.fetched_at)}
              <span> · {data.featured.source_name}</span>
            </div>
            <div className="minis">
              {data.minis.map((m) => (
                <a
                  className="mini"
                  href={m.original_url}
                  key={m.id}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {m.image_url ? <img src={m.image_url} alt="" /> : <span className="mini-empty" />}
                  <div>
                    <span className="kick">{m.topic}</span>
                    <b>{m.title}</b>
                  </div>
                </a>
              ))}
            </div>
          </article>

          <div className="latest">
            <h4>آخرین تیترها</h4>
            <ul>
              {data.latest.map((l) => (
                <li key={l.id}>
                  <span className="kick">{l.topic}</span>
                  <time dateTime={l.published_at ?? l.fetched_at}>
                    {formatClock(l.published_at ?? l.fetched_at)}
                  </time>
                  <b>
                    <a href={l.original_url} target="_blank" rel="noopener noreferrer">
                      {l.title}
                    </a>
                  </b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="empty-note">هنوز خبر تأییدشده‌ای برای نمایش دریافت نشده است.</div>
      )}
    </section>
  )
}
