import { Outlet } from 'react-router-dom'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function RootLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        پرش به محتوای اصلی
      </a>
      <SiteHeader />
      <main id="main" className="main">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}
