import { Outlet } from 'react-router-dom'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function RootLayout() {
  return (
    <>
      <SiteHeader />
      <main className="wrap" id="content">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}
