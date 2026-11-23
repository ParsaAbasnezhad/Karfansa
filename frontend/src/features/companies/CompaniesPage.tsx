import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import { Icon } from '@/features/home/icons'
import {
  DirectoryActiveFilters,
  DirectoryEmpty,
  DirectoryError,
  DirectoryFiltersForm,
  DirectoryHero,
  DirectoryMark,
  DirectorySearch,
  DirectoryShell,
  DirectorySkeleton,
  DirectoryToolbar,
  Pagination,
  VerifiedBadge,
  activeFilterCount,
  directoryIsNarrowed,
  useDirectoryQueryState,
} from '@/features/directory/shared'
import type { CompanyCard, IndustryRef, OrganizationPage } from './types'

function placeLabel(item: CompanyCard) {
  return [item.province?.name_fa, item.city?.name_fa].filter(Boolean).join('، ')
}

function CompanyCardView({ item }: { item: CompanyCard }) {
  const place = placeLabel(item)
  const category = item.industry?.name_fa || item.organization_type_display || ''
  return (
    <Link className="dir-identity" to={`/companies/${encodeURIComponent(item.slug)}`}>
      <div className="dir-identity-head">
        <DirectoryMark src={item.logo} label={item.name} />
        <div className="dir-identity-titles">
          <div className="dir-identity-title-row">
            <h2>{item.name}</h2>
            <VerifiedBadge show={item.is_verified} />
          </div>
          {category && <p className="dir-identity-role">{category}</p>}
        </div>
      </div>
      <p className="dir-identity-place">
        <Icon name="pin" />
        <span>{place || 'محل فعالیت ثبت نشده'}</span>
      </p>
      <p className={item.description ? 'dir-identity-intro' : 'dir-identity-intro is-muted'}>
        {item.description || 'معرفی کوتاهی برای این شرکت ثبت نشده است.'}
      </p>
      {item.organization_type_display && item.industry && (
        <span className="dir-chip">{item.organization_type_display}</span>
      )}
      <span className="dir-identity-cta">
        مشاهده پروفایل
        <Icon name="chev-l" />
      </span>
    </Link>
  )
}

const emptyFilters = {
  q: '',
  province: '',
  city: '',
  verified: '',
  organization_type: '',
  industry: '',
  page: 1,
}

export function CompaniesPage() {
  const { state, write } = useDirectoryQueryState()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pageSize = 12
  const industries = useQuery({
    queryKey: ['organizations', 'industries'],
    queryFn: ({ signal }) => apiGet<IndustryRef[]>('/v1/organizations/industries/', undefined, signal),
  })
  const query = useQuery({
    queryKey: ['organizations', 'list', state],
    queryFn: ({ signal }) =>
      apiGet<OrganizationPage>(
        '/v1/organizations/',
        {
          search: state.q || undefined,
          province: state.province || undefined,
          city: state.city || undefined,
          industry: state.industry || undefined,
          organization_type: state.organization_type || undefined,
          is_verified: state.verified === 'true' ? true : undefined,
          limit: pageSize,
          offset: (state.page - 1) * pageSize,
        },
        signal,
      ),
  })

  const totalPages = query.data ? Math.max(Math.ceil(query.data.count / pageSize), 1) : 1
  const narrowed = directoryIsNarrowed(state)
  const clearAll = () => {
    write(emptyFilters)
    setMobileOpen(false)
  }

  const filters = (
    <DirectoryFiltersForm
      title="پالایش شرکت‌ها"
      state={state}
      showType
      industries={industries.data ?? []}
      onSubmit={(next) => {
        write(next)
        setMobileOpen(false)
      }}
      onClear={clearAll}
    />
  )

  return (
    <section className="dir-page dir-page--board" dir="rtl">
      <DirectoryHero
        kicker="دایرکتوری کسب‌وکارهای حقوقی"
        title="شرکت‌های کارفنسا"
        subtitle="شرکت‌های فعال را بر اساس صنعت، استان و نوع فعالیت پیدا کنید و پروفایل رسمی آن‌ها را ببینید."
        search={
          <DirectorySearch
            value={state.q}
            busy={query.isFetching}
            placeholder="نام شرکت، صنعت یا کلمه کلیدی"
            onSearch={(q) => write({ ...state, q, page: 1 })}
          />
        }
      />
      <DirectoryShell
        filters={filters}
        mobileOpen={mobileOpen}
        filterCount={activeFilterCount(state)}
        onOpenFilters={() => setMobileOpen(true)}
        onCloseFilters={() => setMobileOpen(false)}
      >
        <div className={query.isFetching ? 'dir-results is-busy' : 'dir-results'}>
          <DirectoryToolbar
            busy={query.isFetching && !query.isLoading}
            label={query.isLoading ? 'در حال بارگذاری شرکت‌ها…' : `${formatNumber(query.data?.count ?? 0)} شرکت`}
            action={
              <Link className="dir-button is-soft" to="/join">
                ثبت شرکت
              </Link>
            }
          />
          <DirectoryActiveFilters
            state={state}
            showType
            industries={industries.data ?? []}
            onChange={write}
            onClear={clearAll}
          />
          {query.isLoading ? (
            <DirectorySkeleton variant="cards" />
          ) : query.isError ? (
            <DirectoryError
              title="فهرست شرکت‌ها در دسترس نیست"
              message={
                query.error instanceof ApiError
                  ? query.error.message
                  : 'ارتباط با سرور برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.'
              }
              onRetry={() => void query.refetch()}
            />
          ) : !query.data?.items.length ? (
            <DirectoryEmpty
              title={narrowed ? 'شرکتی با این مشخصات پیدا نشد' : 'هنوز شرکتی در فهرست عمومی نیست'}
              body={
                narrowed
                  ? 'عبارت جست‌وجو یا فیلترهای فعال را تغییر دهید تا شرکت‌های بیشتری نمایش داده شوند.'
                  : 'به‌محض تأیید و انتشار پروفایل شرکت‌ها، این صفحه آن‌ها را نشان می‌دهد.'
              }
              action={
                narrowed ? (
                  <button className="dir-button is-ghost" type="button" onClick={clearAll}>
                    پاک کردن فیلترها
                  </button>
                ) : (
                  <Link className="dir-button" to="/join">
                    ثبت شرکت
                  </Link>
                )
              }
            />
          ) : (
            <>
              <div className="dir-grid">
                {query.data.items.map((item) => (
                  <CompanyCardView key={item.id} item={item} />
                ))}
              </div>
              <Pagination page={state.page} totalPages={totalPages} onChange={(page) => write({ ...state, page })} />
            </>
          )}
        </div>
      </DirectoryShell>
    </section>
  )
}
