import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useIranProvinces, useProvinceCities } from '@/features/account/geography'
import { apiGet } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import type { ProductListingPage, ServiceCategory } from './types'
import { ErrorState, Loading, ProductGrid, ServiceHero } from './shared'
import { API, flattenCategories } from './services.utils'

export function ServicesListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState({
    q: searchParams.get('q') ?? '',
    category: searchParams.get('category') ?? '',
    province: '',
    city: '',
    export: false,
    domestic: false,
    min_price: '',
    max_price: '',
    min_quantity: '',
    max_quantity: '',
    page: 1,
  })
  const categories = useQuery({
    queryKey: ['services', 'categories'],
    queryFn: ({ signal }) => apiGet<ServiceCategory[]>(`${API}/categories/`, undefined, signal),
  })
  const provinces = useIranProvinces()
  const [provinceFilter, setProvinceFilter] = useState(filters.province)
  const [cityFilter, setCityFilter] = useState(filters.city)
  const cities = useProvinceCities(provinceFilter)
  const query = useQuery({
    queryKey: ['services', 'listings', filters],
    queryFn: ({ signal }) => apiGet<ProductListingPage>(
      `${API}/listings/`,
      {
        ...filters,
        export: filters.export || undefined,
        domestic: filters.domestic || undefined,
      },
      signal,
    ),
  })
  const allCategories = useMemo(() => flattenCategories(categories.data ?? []), [categories.data])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const next = {
      q: String(form.get('q') ?? '').trim(),
      category: String(form.get('category') ?? ''),
      province: String(form.get('province') ?? ''),
      city: String(form.get('city') ?? ''),
      export: form.get('export') === 'on',
      domestic: form.get('domestic') === 'on',
      min_price: String(form.get('min_price') ?? '').trim(),
      max_price: String(form.get('max_price') ?? '').trim(),
      min_quantity: String(form.get('min_quantity') ?? '').trim(),
      max_quantity: String(form.get('max_quantity') ?? '').trim(),
      page: 1,
    }
    setFilters(next)
    const params = new URLSearchParams()
    if (next.q) params.set('q', next.q)
    if (next.category) params.set('category', next.category)
    setSearchParams(params)
  }

  return (
    <div className="svc-page" dir="rtl">
      <ServiceHero compact />
      <section className="svc-section">
        <div className="svc-section-heading"><div><span className="svc-eyebrow">بازار محصولات</span><h1>جست‌وجوی محصولات</h1></div></div>
        <form className="svc-filters" onSubmit={submit}>
          <label>نام محصول<input name="q" defaultValue={filters.q} placeholder="مثلاً زعفران یا گندم" /></label>
          <label>دسته‌بندی<select name="category" defaultValue={filters.category}><option value="">همه دسته‌ها</option>{allCategories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
          <label>استان<select name="province" value={provinceFilter} onChange={(event) => {
            setProvinceFilter(event.target.value)
            setCityFilter('')
          }}><option value="">همه استان‌ها</option>{(provinces.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name_fa}</option>)}</select></label>
          <label>شهر<select name="city" value={cityFilter} disabled={!provinceFilter} onChange={(event) => setCityFilter(event.target.value)}><option value="">همه شهرها</option>{(cities.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name_fa}</option>)}</select></label>
          <label>حداقل قیمت<input name="min_price" type="number" min="0" defaultValue={filters.min_price} /></label>
          <label>حداکثر قیمت<input name="max_price" type="number" min="0" defaultValue={filters.max_price} /></label>
          <label>حداقل موجودی<input name="min_quantity" type="number" min="0" step="any" defaultValue={filters.min_quantity} /></label>
          <label>حداکثر موجودی<input name="max_quantity" type="number" min="0" step="any" defaultValue={filters.max_quantity} /></label>
          <label className="svc-checkbox"><input type="checkbox" name="export" defaultChecked={filters.export} /> آماده صادرات</label>
          <label className="svc-checkbox"><input type="checkbox" name="domestic" defaultChecked={filters.domestic} /> فروش داخلی</label>
          <button className="svc-button" type="submit">اعمال فیلتر</button>
        </form>
        {query.isPending ? <Loading /> : query.isError ? <ErrorState error={query.error} /> : (
          <>
            <p className="svc-result-count">{formatNumber(query.data.count)} محصول</p>
            <ProductGrid items={query.data.results} />
            {query.data.total_pages > 1 && (
              <nav className="svc-pagination" aria-label="صفحه‌های محصولات">
                <button
                  type="button"
                  disabled={query.data.page <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                >
                  قبلی
                </button>
                <span>صفحه {formatNumber(query.data.page)} از {formatNumber(query.data.total_pages)}</span>
                <button
                  type="button"
                  disabled={query.data.page >= query.data.total_pages}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                >
                  بعدی
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  )
}
