import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { useIranProvinces, useProvinceCities } from '@/features/account/geography'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from '@/lib/api-client'
import { formatNumber, formatShortDate } from '@/lib/format'
import type { ProductInquiry, ProductListing, ServiceCategory, ServiceSeller } from './types'
import { API, flattenCategories, messageFrom } from './services.utils'
import './services.css'

function ProductCard({ item }: { item: ProductListing }) {
  return (
    <article className="svc-product-card">
      <Link to={`/services/listings/${encodeURIComponent(item.slug)}`} className="svc-product-image">
        {item.images[0] ? (
          <img src={item.images[0].url} alt={item.images[0].alt_text || item.title} loading="lazy" />
        ) : (
          <span aria-hidden="true">محصول کارفنسا</span>
        )}
      </Link>
      <div className="svc-product-copy">
        <div className="svc-product-meta">
          <Link to={`/services/listings?category=${encodeURIComponent(item.category_slug)}`}>
            {item.category_name}
          </Link>
          <span>{item.province_name}{item.city_name ? `، ${item.city_name}` : ''}</span>
        </div>
        <h2><Link to={`/services/listings/${encodeURIComponent(item.slug)}`}>{item.title}</Link></h2>
        <p>{item.description}</p>
        <div className="svc-product-facts">
          <span>موجودی: {formatNumber(Number(item.quantity))} {item.unit}</span>
          <strong>
            {item.price === null
              ? 'قیمت توافقی'
              : `${formatNumber(Number(item.price))} ${item.currency}`}
          </strong>
        </div>
        <div className="svc-badges">
          {item.is_domestic_available && <span>فروش داخلی</span>}
          {item.is_export_available && <span>آماده صادرات</span>}
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ items }: { items: ProductListing[] }) {
  if (!items.length) return <p className="svc-empty">محصولی با این مشخصات پیدا نشد.</p>
  return <div className="svc-product-grid">{items.map((item) => <ProductCard key={item.id} item={item} />)}</div>
}

export function Loading({ label = 'در حال دریافت اطلاعات…' }: { label?: string }) {
  return <p className="svc-state" role="status">{label}</p>
}

export function ErrorState({ error }: { error: unknown }) {
  return <p className="svc-error" role="alert">{messageFrom(error)}</p>
}

export function ServiceHero({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`svc-hero${compact ? ' svc-hero-compact' : ''}`}>
      <div>
        <span className="svc-eyebrow">بازار محصولات کارفنسا</span>
        <h1>محصول ایرانی، مستقیم از تولیدکننده</h1>
        <p>بازار فروش محصولات کشاورزی، دامی و صنایع‌دستی برای فروش داخلی و صادرات.</p>
      </div>
      <Link className="svc-button svc-button-light" to="/services/dashboard">ثبت محصول</Link>
    </section>
  )
}

export function InquiryForm({ listing }: { listing: ProductListing }) {
  const { data: user } = useAuth()
  const [sent, setSent] = useState(false)
  const mutation = useMutation({
    mutationFn: (body: { message: string; quantity: string | null }) =>
      apiPost(`${API}/listings/${encodeURIComponent(listing.slug)}/inquiries`, body),
    onSuccess: () => setSent(true),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      message: String(form.get('message') ?? '').trim(),
      quantity: String(form.get('quantity') ?? '').trim() || null,
    })
  }
  if (sent) return <p className="svc-success" role="status">درخواست شما برای فروشنده ارسال شد.</p>
  if (!user) return <p className="svc-login-note"><Link to="/login">برای ارسال درخواست وارد حساب شوید.</Link></p>
  return (
    <form className="svc-inquiry-form" onSubmit={submit}>
      <h2>درخواست خرید</h2>
      <label>مقدار موردنیاز (اختیاری)<input name="quantity" type="number" min="0" step="any" /></label>
      <label>پیام به فروشنده<textarea name="message" minLength={5} maxLength={2000} required rows={4} /></label>
      {mutation.isError && <p className="svc-error" role="alert">{messageFrom(mutation.error)}</p>}
      <button className="svc-button" disabled={mutation.isPending}>{mutation.isPending ? 'در حال ارسال…' : 'ارسال درخواست'}</button>
    </form>
  )
}

export function SellerProfileForm({ existing }: { existing?: ServiceSeller }) {
  const queryClient = useQueryClient()
  const provinces = useIranProvinces()
  const [provinceId, setProvinceId] = useState(existing?.province_id ? String(existing.province_id) : '')
  const [cityId, setCityId] = useState(existing?.city_id ? String(existing.city_id) : '')
  const cities = useProvinceCities(provinceId)
  const mutation = useMutation({
    mutationFn: (body: unknown) => apiPut(`${API}/seller/profile`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const p = String(form.get('province_id') ?? '')
    mutation.mutate({
      display_name: String(form.get('display_name') ?? '').trim(),
      bio: String(form.get('bio') ?? '').trim(),
      province_id: p ? Number(p) : null,
      city_id: String(form.get('city_id') ?? '') ? Number(form.get('city_id')) : null,
      is_public: form.get('is_public') === 'on',
    })
  }
  return (
    <form className="svc-form-card" onSubmit={submit} key={existing?.id ?? 'new-profile'}>
      <h2>{existing ? 'ویرایش پروفایل فروشندگی' : 'ساخت پروفایل فروشندگی'}</h2>
      <p>برای عرضه محصول به ثبت شرکت نیاز ندارید. اطلاعات تماس خصوصی شما نمایش داده نمی‌شود.</p>
      <label>نام نمایشی<input name="display_name" minLength={2} maxLength={120} required defaultValue={existing?.display_name} /></label>
      <label>معرفی کوتاه<textarea name="bio" maxLength={1500} rows={3} defaultValue={existing?.bio} /></label>
      <label>استان<select name="province_id" value={provinceId} onChange={(event) => {
        setProvinceId(event.target.value)
        setCityId('')
      }}><option value="">انتخاب استان</option>{(provinces.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name_fa}</option>)}</select></label>
      <label>شهر<select name="city_id" disabled={!provinceId} value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">انتخاب شهر</option>{(cities.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name_fa}</option>)}</select></label>
      <label className="svc-checkbox"><input type="checkbox" name="is_public" defaultChecked={existing?.is_public ?? true} /> نمایش پروفایل عمومی</label>
      {mutation.isError && <p className="svc-error" role="alert">{messageFrom(mutation.error)}</p>}
      {mutation.isSuccess && <p className="svc-success" role="status">پروفایل ذخیره شد.</p>}
      <button className="svc-button" disabled={mutation.isPending}>{mutation.isPending ? 'در حال ذخیره…' : 'ذخیره پروفایل'}</button>
    </form>
  )
}

export function InquiryList({ inquiries }: { inquiries: ProductInquiry[] }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiPatch(`${API}/inquiries/${id}`, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['services', 'received-inquiries'] }),
  })
  if (!inquiries.length) return <p className="svc-empty">هنوز درخواستی دریافت نشده است.</p>
  return (
    <div className="svc-inquiry-list">
      {mutation.isError && <p className="svc-error" role="alert">{messageFrom(mutation.error)}</p>}
      {inquiries.map((item) => (
        <article key={item.id}>
          <div><strong>{item.buyer_name}</strong><span>{item.status_display} · {formatShortDate(item.created_at)}</span></div>
          <Link to={`/services/listings/${encodeURIComponent(item.listing_slug)}`}>{item.listing_title}</Link>
          <p>{item.message}</p>
          {item.quantity && <small>مقدار درخواستی: {formatNumber(Number(item.quantity))}</small>}
          {item.status === 'new' && <button type="button" onClick={() => mutation.mutate({ id: item.id, status: 'read' })}>علامت‌گذاری به‌عنوان خوانده‌شده</button>}
          {item.status === 'read' && <button type="button" onClick={() => mutation.mutate({ id: item.id, status: 'replied' })}>ثبت پاسخ</button>}
        </article>
      ))}
    </div>
  )
}

export function ListingForm({ listing }: { listing?: ProductListing }) {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const categories = useQuery({
    queryKey: ['services', 'categories'],
    queryFn: ({ signal }) => apiGet<ServiceCategory[]>(`${API}/categories/`, undefined, signal),
  })
  const provinces = useIranProvinces()
  const [provinceId, setProvinceId] = useState(listing ? String(listing.province_id) : '')
  const [cityId, setCityId] = useState(listing?.city_id ? String(listing.city_id) : '')
  const cities = useProvinceCities(provinceId)
  const imageMutation = useMutation({
    mutationFn: (imageId: number) => apiDelete(`${API}/my/images/${imageId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['services', 'my-listings'] }),
  })
  const mutation = useMutation({
    mutationFn: async ({ body, files }: { body: Record<string, unknown>; files: File[] }) => {
      const saved = listing
        ? await apiPut<ProductListing>(`${API}/my/listings/${listing.id}`, body)
        : await apiPost<ProductListing>(`${API}/my/listings`, body)
      for (const file of files) {
        await apiUpload(`${API}/my/listings/${saved.id}/images`, file)
      }
      return saved
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['services'] })
      navigate('/services/dashboard', { state: { savedStatus: saved.status } })
    },
  })
  const allCategories = flattenCategories(categories.data ?? [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    const form = new FormData(event.currentTarget)
    const specifications = String(form.get('specifications') ?? '')
      .split('\n')
      .map((line) => line.split(':'))
      .filter((pair) => pair.length >= 2 && pair[0].trim() && pair.slice(1).join(':').trim())
      .map((pair) => ({ name: pair[0].trim(), value: pair.slice(1).join(':').trim() }))
    const files = Array.from(
      event.currentTarget.querySelector<HTMLInputElement>('[name="images"]')?.files ?? [],
    )
    mutation.mutate({
      body: {
        category_id: Number(form.get('category_id')),
        province_id: Number(form.get('province_id')),
        city_id: String(form.get('city_id') ?? '') ? Number(form.get('city_id')) : null,
        title: String(form.get('title') ?? '').trim(),
        description: String(form.get('description') ?? '').trim(),
        sale_mode: String(form.get('sale_mode')),
        quantity: String(form.get('quantity') ?? '').trim(),
        unit: String(form.get('unit') ?? '').trim(),
        price: String(form.get('price') ?? '').trim() || null,
        currency: String(form.get('currency') ?? 'IRR').trim().toUpperCase(),
        is_price_negotiable: form.get('is_price_negotiable') === 'on',
        minimum_order_quantity: String(form.get('minimum_order_quantity') ?? '').trim() || null,
        quality: String(form.get('quality') ?? '').trim(),
        packaging: String(form.get('packaging') ?? '').trim(),
        specifications,
        submit_for_review: form.get('submit_for_review') === 'on',
      },
      files,
    })
  }

  if (!user) return <p className="svc-login-note"><Link to="/login">برای ثبت محصول وارد حساب شوید.</Link></p>
  return (
    <form className="svc-form-card svc-listing-form" onSubmit={submit} key={listing?.id ?? 'new-listing'}>
      <h1>{listing ? 'ویرایش محصول' : 'ثبت محصول جدید'}</h1>
      <p>پس از ارسال، محصول برای بررسی مدیران فرستاده می‌شود.</p>
      <label>نام محصول<input name="title" minLength={3} maxLength={180} required defaultValue={listing?.title} /></label>
      <label>معرفی محصول<textarea name="description" minLength={10} maxLength={5000} required rows={5} defaultValue={listing?.description} /></label>
      <div className="svc-form-grid">
        <label>دسته‌بندی<select name="category_id" required defaultValue={listing?.category_id ?? ''}><option value="">انتخاب دسته‌بندی</option>{allCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>نوع فروش<select name="sale_mode" defaultValue={listing?.sale_mode ?? 'both'}><option value="both">فروش داخلی و صادرات</option><option value="domestic">فروش داخلی</option><option value="export">صادرات</option></select></label>
        <label>استان<select name="province_id" required value={provinceId} onChange={(event) => {
          setProvinceId(event.target.value)
          setCityId('')
        }}><option value="">انتخاب استان</option>{(provinces.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name_fa}</option>)}</select></label>
        <label>شهر<select name="city_id" disabled={!provinceId} value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">انتخاب شهر</option>{(cities.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name_fa}</option>)}</select></label>
        <label>موجودی<input name="quantity" type="number" min="0.0001" step="any" required defaultValue={listing?.quantity} /></label>
        <label>واحد اندازه‌گیری<input name="unit" maxLength={40} required placeholder="کیلوگرم، تن، عدد…" defaultValue={listing?.unit} /></label>
        <label>قیمت واحد<input name="price" type="number" min="0" step="any" defaultValue={listing?.price ?? ''} /></label>
        <label>واحد پول<input name="currency" maxLength={3} defaultValue={listing?.currency || 'IRR'} /></label>
        <label>حداقل سفارش<input name="minimum_order_quantity" type="number" min="0.0001" step="any" defaultValue={listing?.minimum_order_quantity ?? ''} /></label>
        <label>کیفیت و درجه‌بندی<input name="quality" maxLength={500} defaultValue={listing?.quality} /></label>
        <label>بسته‌بندی<input name="packaging" maxLength={500} defaultValue={listing?.packaging} /></label>
      </div>
      <label className="svc-checkbox"><input name="is_price_negotiable" type="checkbox" defaultChecked={listing?.is_price_negotiable} /> قیمت توافقی است</label>
      <label>مشخصات بیشتر (هر خط: ویژگی: مقدار)<textarea name="specifications" rows={3} defaultValue={listing?.specifications.map((item) => `${item.name}: ${item.value}`).join('\n')} /></label>
      <label>تصاویر محصول<input name="images" type="file" accept=".jpg,.jpeg,.png,.webp" multiple /></label>
      <small>حداکثر ۱۰ تصویر، هر تصویر حداکثر ۲ مگابایت؛ JPG، PNG یا WebP.</small>
      {listing?.images.length ? (
        <div className="svc-image-manager" aria-label="تصاویر ثبت‌شده">
          {listing.images.map((image) => (
            <figure key={image.id}>
              <img src={image.url} alt={image.alt_text || listing.title} />
              <button
                type="button"
                disabled={imageMutation.isPending}
                onClick={() => imageMutation.mutate(image.id)}
              >
                حذف تصویر
              </button>
            </figure>
          ))}
          {imageMutation.isError && <p className="svc-error" role="alert">{messageFrom(imageMutation.error)}</p>}
        </div>
      ) : null}
      <label className="svc-checkbox"><input name="submit_for_review" type="checkbox" defaultChecked /> ارسال برای بررسی و انتشار</label>
      {mutation.isError && <p className="svc-error" role="alert">{messageFrom(mutation.error)}</p>}
      <button className="svc-button" disabled={mutation.isPending}>{mutation.isPending ? 'در حال ذخیره…' : 'ذخیره محصول'}</button>
    </form>
  )
}
