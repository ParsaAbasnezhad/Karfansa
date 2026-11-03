import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'صفحه پیدا نشد | کارفنسا'
  }, [])
  return (
    <section className="panel sec notfound">
      <p className="nf-code">۴۰۴</p>
      <h1>صفحه‌ای که دنبالش بودید پیدا نشد</h1>
      <p>ممکن است نشانی تغییر کرده یا صفحه هنوز منتشر نشده باشد.</p>
      <Link className="btn" to="/">
        بازگشت به صفحه اصلی
      </Link>
    </section>
  )
}
