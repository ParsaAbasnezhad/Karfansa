import { lazy, Suspense, useEffect, useRef } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  matchPath,
  useLocation,
  useParams,
  type Location,
} from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/search/NotFoundPage'
import { SearchPage } from '@/features/search/SearchPage'
import { AboutPage } from '@/features/about/AboutPage'
import { ContactPage } from '@/features/about/ContactPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { MarketsPage } from '@/features/markets/MarketsPage'
import { AccountPage } from '@/features/account/AccountPage'
import { BusinessDashboardPage } from '@/features/business/BusinessDashboardPage'
import { JoinPage } from '@/features/business/JoinPage'
import { CompaniesPage } from '@/features/companies/CompaniesPage'
import { CompanyProfilePage } from '@/features/companies/CompanyProfilePage'
import { IndividualsPage } from '@/features/individuals/IndividualsPage'
import { IndividualProfilePage } from '@/features/individuals/IndividualProfilePage'
import { GuestTrackPage } from '@/features/support/GuestTrackPage'
import { SupportCenterPage } from '@/features/support/SupportCenterPage'
import { TicketDetailPage } from '@/features/support/TicketDetailPage'
import { ProvincesPage } from '@/features/provinces/ProvincesPage'
import { ProvinceDetailPage } from '@/features/provinces/ProvinceDetailPage'
import { IndustriesPage } from '@/features/provinces/IndustriesPage'
import { TradeOpportunitiesPage } from '@/features/trade/TradeOpportunitiesPage'
import { TradeOpportunityDetailPage } from '@/features/trade/TradeOpportunityDetailPage'
import {
  ServicesDashboardPage,
  ServicesLandingPage,
  ServicesListingFormPage,
  ServicesListingsPage,
  ServicesProductDetailPage,
} from '@/features/services/ServicesPages'

const TransportationCompaniesPage = lazy(() =>
  import('@/features/transportation/TransportationCompaniesPage').then((mod) => ({
    default: mod.TransportationCompaniesPage,
  })),
)
const InquiryDashboardPage = lazy(() =>
  import('@/features/inquiries/InquiryDashboardPage').then((mod) => ({
    default: mod.InquiryDashboardPage,
  })),
)
const TransportationCompanyDetailPage = lazy(() =>
  import('@/features/transportation/TransportationCompanyDetailPage').then((mod) => ({
    default: mod.TransportationCompanyDetailPage,
  })),
)
const AnalysisArchivePage = lazy(() =>
  import('@/features/analysis/AnalysisPages').then((mod) => ({
    default: mod.AnalysisArchivePage,
  })),
)
const AnalysisDetailPage = lazy(() =>
  import('@/features/analysis/AnalysisPages').then((mod) => ({
    default: mod.AnalysisDetailPage,
  })),
)

function TransportationFallback() {
  return (
    <section className="tx-page" dir="rtl">
      <p>در حال بارگذاری بخش حمل‌ونقل…</p>
    </section>
  )
}

function AnalysisFallback() {
  return (
    <section className="analysis-page" dir="rtl" aria-busy="true">
      <p>در حال بارگذاری تحلیل و گزارش…</p>
    </section>
  )
}

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

const pageTitles: { paths: string[]; title: string }[] = [
  { paths: ['/business'], title: 'داشبورد کسب‌وکار' },
  { paths: ['/about'], title: 'درباره ما' },
  { paths: ['/contact'], title: 'تماس با ما' },
  { paths: ['/markets'], title: 'بازارها' },
  { paths: ['/analysis', '/analysis/:slug'], title: 'تحلیل و گزارش' },
  { paths: ['/provinces', '/provinces/:slug'], title: 'استان‌ها' },
  { paths: ['/industries'], title: 'مناطق و صنایع' },
  { paths: ['/trade', '/trade/:slug'], title: 'فرصت‌های تجاری' },
  { paths: ['/services', '/services/listings'], title: 'بازار محصولات' },
  { paths: ['/services/listings/new'], title: 'ثبت محصول' },
  { paths: ['/services/listings/:listingId/edit'], title: 'ویرایش محصول' },
  { paths: ['/services/listings/:slug'], title: 'جزئیات محصول' },
  { paths: ['/services/dashboard'], title: 'داشبورد محصولات' },
  { paths: ['/companies'], title: 'شرکت‌ها' },
  { paths: ['/companies/:slug'], title: 'پروفایل شرکت' },
  { paths: ['/transportation/companies'], title: 'شرکت‌های حمل‌ونقل' },
  { paths: ['/transportation/companies/:slug'], title: 'پروفایل شرکت حمل‌ونقل' },
  { paths: ['/individuals'], title: 'فعالان اقتصادی' },
  { paths: ['/individuals/:individualId'], title: 'پروفایل فعال اقتصادی' },
  { paths: ['/search'], title: 'جست‌وجو' },
  { paths: ['/account'], title: 'حساب کاربری' },
  { paths: ['/account/inquiries'], title: 'درخواست‌ها' },
  { paths: ['/join'], title: 'ثبت کسب‌وکار' },
  { paths: ['/account/support'], title: 'مرکز پشتیبانی' },
  { paths: ['/account/support/:ticketNumber'], title: 'جزئیات درخواست پشتیبانی' },
  { paths: ['/support/track'], title: 'پیگیری درخواست' },
  { paths: ['/login'], title: 'ورود و ثبت‌نام' },
]

function titleForPath(pathname: string) {
  if (pathname === '/') return 'کارفنسا | صفحه اصلی'
  const page = pageTitles.find(({ paths }) =>
    paths.some((path) => matchPath({ path, end: true }, pathname)),
  )
  return `${page?.title ?? 'صفحه پیدا نشد'} | کارفنسا`
}

function SellerLegacyRedirect() {
  const { sellerId = '' } = useParams()
  return <Navigate to={`/individuals/${encodeURIComponent(sellerId)}`} replace />
}

function AppRoutes() {
  const location = useLocation()
  const siteRef = useRef<HTMLDivElement>(null)
  const loginOpen = isLoginPath(location.pathname)
  const background = (location.state as { backgroundLocation?: Location } | null)
    ?.backgroundLocation
  const siteLocation = loginOpen ? (background ?? homeLocation) : location

  useEffect(() => {
    document.title = titleForPath(location.pathname)
  }, [location.pathname])

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
          <Route path="/business" element={<BusinessDashboardPage />} />
          <Route path="/" element={<RootLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="markets" element={<MarketsPage />} />
            <Route
              path="analysis"
              element={
                <Suspense fallback={<AnalysisFallback />}>
                  <AnalysisArchivePage />
                </Suspense>
              }
            />
            <Route
              path="analysis/:slug"
              element={
                <Suspense fallback={<AnalysisFallback />}>
                  <AnalysisDetailPage />
                </Suspense>
              }
            />
            <Route path="provinces" element={<ProvincesPage />} />
            <Route path="provinces/:slug" element={<ProvinceDetailPage />} />
            <Route path="industries" element={<IndustriesPage />} />
            <Route path="trade" element={<TradeOpportunitiesPage />} />
            <Route path="trade/:slug" element={<TradeOpportunityDetailPage />} />
            <Route path="services" element={<ServicesLandingPage />} />
            <Route path="services/listings" element={<ServicesListingsPage />} />
            <Route path="services/listings/new" element={<ServicesListingFormPage />} />
            <Route path="services/listings/:listingId/edit" element={<ServicesListingFormPage />} />
            <Route path="services/listings/:slug" element={<ServicesProductDetailPage />} />
            <Route
              path="services/sellers/:sellerId"
              element={<SellerLegacyRedirect />}
            />
            <Route path="services/dashboard" element={<ServicesDashboardPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="companies/:slug" element={<CompanyProfilePage />} />
            <Route
              path="transportation/companies"
              element={
                <Suspense fallback={<TransportationFallback />}>
                  <TransportationCompaniesPage />
                </Suspense>
              }
            />
            <Route
              path="transportation/companies/:slug"
              element={
                <Suspense fallback={<TransportationFallback />}>
                  <TransportationCompanyDetailPage />
                </Suspense>
              }
            />
            <Route path="transportation" element={<Navigate to="/transportation/companies" replace />} />
            <Route path="transport" element={<Navigate to="/transportation/companies" replace />} />
            <Route path="transport/register" element={<Navigate to="/join" replace />} />
            <Route path="individuals" element={<IndividualsPage />} />
            <Route path="individuals/:individualId" element={<IndividualProfilePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="account/inquiries" element={<Suspense fallback={<p dir="rtl">در حال بارگذاری درخواست‌ها…</p>}><InquiryDashboardPage /></Suspense>} />
            <Route path="join" element={<JoinPage />} />
            <Route path="register-company" element={<Navigate to="/join" replace />} />
            <Route path="account/support" element={<SupportCenterPage />} />
            <Route path="account/support/:ticketNumber" element={<TicketDetailPage />} />
            <Route path="support/track" element={<GuestTrackPage />} />
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
