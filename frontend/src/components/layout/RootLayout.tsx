import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function RootLayout() {
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login'

  return (
    <>
      {!isAuthPage && <SiteHeader />}
      <main className={isAuthPage ? 'wrap auth-main' : 'wrap'} id="content">
        <Outlet />
      </main>
      {!isAuthPage && <SiteFooter />}
      <ScrollRestoration />
    </>
  )
}
