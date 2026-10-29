import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="section">
      <div className="container container--narrow">
        <h1 className="section__title">صفحه پیدا نشد</h1>
        <p>نشانی را بررسی کنید یا به صفحه‌ی اول برگردید.</p>
        <p>
          <Link to="/">صفحه‌ی اول</Link>
        </p>
      </div>
    </section>
  )
}
