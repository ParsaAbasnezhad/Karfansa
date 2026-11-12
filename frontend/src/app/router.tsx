import { createBrowserRouter } from 'react-router-dom'
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

export const routes = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'markets', element: <MarketsPage /> },
      { path: 'provinces', element: <ProvincesPage /> },
      { path: 'provinces/:slug', element: <ProvinceDetailPage /> },
      { path: 'industries', element: <IndustriesPage /> },
      { path: 'trade', element: <TradeOpportunitiesPage /> },
      { path: 'services', element: <ServicesLandingPage /> },
      { path: 'services/listings', element: <ServicesListingsPage /> },
      { path: 'services/listings/new', element: <ServicesListingFormPage /> },
      { path: 'services/listings/:listingId/edit', element: <ServicesListingFormPage /> },
      { path: 'services/listings/:slug', element: <ServicesProductDetailPage /> },
      { path: 'services/sellers/:sellerId', element: <ServicesSellerPage /> },
      { path: 'services/dashboard', element: <ServicesDashboardPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'login', element: <AuthPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
