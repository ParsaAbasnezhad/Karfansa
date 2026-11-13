import { useEffect, useRef } from 'react'
import { BrowserRouter, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/search/NotFoundPage'
import { SearchPage } from '@/features/search/SearchPage'
import { AboutPage } from '@/features/about/AboutPage'
import { ContactPage } from '@/features/about/ContactPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { NewsPage } from '@/features/news/NewsPage'
import { MarketsPage } from '@/features/markets/MarketsPage'
import { AccountPage } from '@/features/account/AccountPage'
import { ProvincesPage } from '@/features/provinces/ProvincesPage'
import { ProvinceDetailPage } from '@/features/provinces/ProvinceDetailPage'
import { IndustriesPage } from '@/features/provinces/IndustriesPage'
import { TradeOpportunitiesPage } from '@/features/trade/TradeOpportunitiesPage'
import {
  ServicesDashboardPage,
  ServicesLandingPage,
  ServicesListingFormPage,
  ServicesListingsPage,
  ServicesProductDetailPage,
  ServicesSellerPage,
} from '@/features/services/ServicesPages'

const homeLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'auth-home',
} as Location

function isLoginPath(pathname: string) {
  return pathname.replace(/\/$/, '') === '/login'
}

function AppRoutes() {
  const location = useLocation()
  const siteRef = useRef<HTMLDivElement>(null)
  const loginOpen = isLoginPath(location.pathname)
  const background = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation
  const siteLocation = loginOpen ? (background ?? homeLocation) : location

  useEffect(() => {
    const site = siteRef.current
    if (!site) return
    if (loginOpen) site.setAttribute('inert', '')
    else site.removeAttribute('inert')
    const previous = document.body.style.overflow
    if (loginOpen) document.body.style.overflow = 'hidden'
    return () => {
      site.removeAttribute('inert')
      document.body.style.overflow = previous
    }
  }, [loginOpen])

  return (
    <>
      <div ref={siteRef} className={loginOpen ? 'site-under-auth' : undefined}>
        <Routes location={siteLocation}>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="markets" element={<MarketsPage />} />
            <Route path="provinces" element={<ProvincesPage />} />
            <Route path="provinces/:slug" element={<ProvinceDetailPage />} />
            <Route path="industries" element={<IndustriesPage />} />
            <Route path="trade" element={<TradeOpportunitiesPage />} />
            <Route path="services" element={<ServicesLandingPage />} />
            <Route path="services/listings" element={<ServicesListingsPage />} />
            <Route path="services/listings/new" element={<ServicesListingFormPage />} />
            <Route path="services/listings/:listingId/edit" element={<ServicesListingFormPage />} />
            <Route path="services/listings/:slug" element={<ServicesProductDetailPage />} />
            <Route path="services/sellers/:sellerId" element={<ServicesSellerPage />} />
            <Route path="services/dashboard" element={<ServicesDashboardPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="login" element={null} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </div>
      {loginOpen && <AuthPage />}
    </>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
