import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/search/NotFoundPage'
import { SearchPage } from '@/features/search/SearchPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routes)
export const createTestRouter = (initialEntries: string[]) =>
  createMemoryRouter(routes, { initialEntries })
