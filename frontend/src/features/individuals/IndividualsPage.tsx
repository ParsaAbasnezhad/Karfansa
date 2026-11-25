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
import type { IndividualCard, IndividualPage } from './types'

function IndividualCardView({ item }: { item: IndividualCard }) {
  const place = [item.province_name, item.city_name].filter(Boolean).join('، ')
  return (
    <Link className="dir-identity dir-identity--person" to={`/individuals/${item.id}`}>
      <div className="dir-identity-head">
        <DirectoryMark src={item.profile_image} label={item.display_name} person />
        <div className="dir-identity-titles">
          <div className="dir-identity-title-row">
            <h2>{item.display_name}</h2>
            <VerifiedBadge show={item.is_verified} />
          </div>
          {item.professional_title && <p className="dir-identity-role">{item.professional_title}</p>}
        </div>
      </div>
      <p className="dir-identity-place">
        <Icon name="pin" />
        <span>{place || 'محل فعالیت ثبت نشده'}</span>
      </p>
      <p className={item.bio ? 'dir-identity-intro' : 'dir-identity-intro is-muted'}>
        {item.bio || 'معرفی کوتاهی برای این پروفایل ثبت نشده است.'}
      </p>
      {item.listings_count > 0 && (
        <span className="dir-chip">{formatNumber(item.listings_count)} آگهی عمومی</span>
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
  page: 1,
}

export function IndividualsPage() {
  const { state, write } = useDirectoryQueryState()
  const [mobileOpen, setMobileOpen] = useState(false)
  const query = useQuery({
    queryKey: ['individuals', 'list', state],
    queryFn: ({ signal }) =>
      apiGet<IndividualPage>(
        '/v1/individuals/',
        {
          q: state.q || undefined,
          province: state.province || undefined,
          city: state.city || undefined,
          verified: state.verified === 'true' ? true : undefined,
          page: state.page,
          page_size: 12,
        },
        signal,
      ),
  })

  const narrowed = directoryIsNarrowed(state)
  const clearAll = () => {
    write(emptyFilters)
    setMobileOpen(false)
  }
  const errorMessage =
    query.error instanceof ApiError
      ? query.error.message
      : 'ارتباط با سرور برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.'

  const filters = (
    <DirectoryFiltersForm
      title="پالایش فعالان"
      state={state}
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
        kicker="شبکه فعالان مستقل"
        title="فعالان اقتصادی و فروشندگان حقیقی"
        subtitle="پروفایل‌های عمومی فروشندگان و فعالان حقیقی را جدا از شرکت‌های حقوقی مرور کنید."
        search={
          <DirectorySearch
            value={state.q}
            busy={query.isFetching}
            placeholder="نام، تخصص یا کلمه کلیدی"
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
            label={query.isLoading ? 'در حال بارگذاری پروفایل‌ها…' : `${formatNumber(query.data?.count ?? 0)} پروفایل`}
            action={
              <Link className="dir-button is-soft" to="/join">
                ثبت فعالیت فردی
              </Link>
            }
          />
          <DirectoryActiveFilters state={state} onChange={write} onClear={clearAll} />
          {query.isLoading ? (
            <DirectorySkeleton variant="cards" />
          ) : query.isError ? (
            <DirectoryError
              title="فهرست فعالان در دسترس نیست"
              message={errorMessage}
              onRetry={() => void query.refetch()}
            />
          ) : !query.data?.results.length ? (
            <DirectoryEmpty
              title={narrowed ? 'پروفایلی با این مشخصات پیدا نشد' : 'هنوز پروفایل فردی عمومی نیست'}
              body={
                narrowed
                  ? 'عبارت جست‌وجو یا فیلترها را تغییر دهید تا فعالان بیشتری نمایش داده شوند.'
                  : 'فروشندگان حقیقی پس از انتشار پروفایل عمومی در این شبکه دیده می‌شوند.'
              }
              action={
                narrowed ? (
                  <button className="dir-button is-ghost" type="button" onClick={clearAll}>
                    پاک کردن فیلترها
                  </button>
                ) : (
                  <Link className="dir-button" to="/join">
                    ثبت فعالیت فردی
                  </Link>
                )
              }
            />
          ) : (
            <>
              <div className="dir-grid">
                {query.data.results.map((item) => (
                  <IndividualCardView key={item.id} item={item} />
                ))}
              </div>
              <Pagination
                page={state.page}
                totalPages={query.data.total_pages || 1}
                onChange={(page) => write({ ...state, page })}
              />
            </>
          )}
        </div>
      </DirectoryShell>
    </section>
  )
}
