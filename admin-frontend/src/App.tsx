import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { Navigate, Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'
import { Loading } from '@/components/ui'
import { ToastProvider } from '@/components/ToastProvider'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import ControlLayout from '@/layouts/ControlLayout'

const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ResourceListPage = lazy(() => import('@/pages/ResourceListPage'))
const ResourceDetailPage = lazy(() => import('@/pages/ResourceDetailPage'))
const ResourceFormPage = lazy(() => import('@/pages/ResourceFormPage'))
const HealthPage = lazy(() => import('@/pages/HealthPage'))
const SecurityPage = lazy(() => import('@/pages/SecurityPage'))

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, gcTime: 5 * 60_000 } } })

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

const router = createBrowserRouter(createRoutesFromElements(<>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Protected><ControlLayout /></Protected>}>
      <Route index element={<DashboardPage />} />
      <Route path="health" element={<HealthPage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="resources/:slug" element={<ResourceListPage />} />
      <Route path="resources/:slug/new" element={<ResourceFormPage />} />
      <Route path="resources/:slug/:id" element={<ResourceDetailPage />} />
      <Route path="resources/:slug/:id/edit" element={<ResourceFormPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </>))

export default function App() {
  return <QueryClientProvider client={queryClient}><ToastProvider><AuthProvider><Suspense fallback={<div className="page-loading"><Loading /></div>}><RouterProvider router={router} /></Suspense></AuthProvider></ToastProvider></QueryClientProvider>
}
