import { Link, useSearchParams } from 'react-router-dom'
import { SearchForm } from '@/features/home/SearchForm'

/** Placeholder: real search arrives in a later phase. It proves routing and query handling. */
export function SearchPage() {
  const [params] = useSearchParams()
  const query = params.get('q')?.trim() ?? ''

  return (
    <section className="section">
      <div className="container container--narrow">
        <h1 className="section__title">جست‌وجو</h1>
        <SearchForm key={query} initialQuery={query} />
        {query ? (
          <p className="notice">
            جست‌وجوی «{query}» هنوز فعال نیست. این بخش در مرحله‌های بعدی ساخته می‌شود.
          </p>
        ) : (
          <p className="notice">نام یک محصول را وارد کنید.</p>
        )}
        <p>
          <Link to="/">بازگشت به صفحه‌ی اول</Link>
        </p>
      </div>
    </section>
  )
}
