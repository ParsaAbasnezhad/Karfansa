import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppLink } from '@/components/AppLink'
import { apiGet } from '@/lib/api-client'
import { formatNumber, timeAgo } from '@/lib/format'
import type { SearchResponse } from '@/lib/types'
import { ErrorBox, Skeleton } from '../home/parts'

export function SearchPage() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()

  useEffect(() => {
    document.title = q ? `جستجوی «${q}» | کارفنسا` : 'جستجو | کارفنسا'
  }, [q])

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => apiGet<SearchResponse>('/search/', { q }, signal),
    enabled: q.length > 0,
  })

  return (
    <section className="panel sec searchpage">
      <h1>{q ? <>نتایج جستجو برای «{q}»</> : 'جستجو در کارفنسا'}</h1>
      {!q && <p className="empty-note">عبارتی را در کادر جستجوی بالای صفحه وارد کنید.</p>}
      {q && isError && <ErrorBox onRetry={() => void refetch()} />}
      {q && !data && !isError && <Skeleton height={200} />}
      {data && (
        <>
          <p className="sub" aria-live="polite">
            {formatNumber(data.count)} نتیجه یافت شد
          </p>
          {data.count === 0 ? (
            <p className="empty-note">نتیجه‌ای پیدا نشد. عبارت دیگری را امتحان کنید.</p>
          ) : (
            <ul className="results" style={{ opacity: isFetching ? 0.6 : 1 }}>
              {data.results.map((r) => (
                <li key={r.id}>
                  <span className="kick">{r.category}</span>
                  <h3>
                    <AppLink href={r.url}>{r.title}</AppLink>
                  </h3>
                  {r.excerpt && <p>{r.excerpt}</p>}
                  <time dateTime={r.published_at}>{timeAgo(r.published_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
