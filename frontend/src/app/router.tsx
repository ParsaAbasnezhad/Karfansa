import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/search/NotFoundPage'
import { SearchPage } from '@/features/search/SearchPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { NewsPage } from '@/features/news/NewsPage'
import { MarketsPage } from '@/features/markets/MarketsPage'
import { AccountPage } from '@/features/account/AccountPage'
import { ProvincesPage } from '@/features/provinces/ProvincesPage'
import { ProvinceDetailPage } from '@/features/provinces/ProvinceDetailPage'
import { IndustriesPage } from '@/features/provinces/IndustriesPage'
import { TradeOpportunitiesPage } from '@/features/trade/TradeOpportunitiesPage'

export const routes = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'markets', element: <MarketsPage /> },
      { path: 'provinces', element: <ProvincesPage /> },
      { path: 'provinces/:slug', element: <ProvinceDetailPage /> },
      { path: 'industries', element: <IndustriesPage /> },
      { path: 'trade', element: <TradeOpportunitiesPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'login', element: <AuthPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
