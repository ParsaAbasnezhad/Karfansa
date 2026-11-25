const http = require('http')

let mode = { kind: 'organization', status: 'rejected' }
const orgId = '11111111-1111-4111-8111-111111111111'
const individualId = '1'

function identity() {
  const isOrg = mode.kind === 'organization'
  return {
    kind: mode.kind,
    id: isOrg ? orgId : individualId,
    label: isOrg ? 'شرکت توسعه تجارت بین‌المللی افق روشن پارس' : 'سارا احمدی',
    role: 'owner',
    verification_status: mode.status,
    is_active_context: true,
  }
}

function dashboard() {
  const current = identity()
  return {
    ...current,
    rejection_reason: mode.status === 'rejected'
      ? 'تصویر آگهی ثبت خوانا نیست. لطفاً نسخه واضح و کامل مدرک را دوباره بارگذاری کنید.'
      : '',
    can_publish: false,
    can_edit_profile: true,
    can_submit_verification: mode.status !== 'suspended',
    can_manage_members: false,
    can_manage_trade: false,
    listings_total: 0,
    inquiries_new: 0,
    opportunities_total: 0,
  }
}

function organizationProfile() {
  return {
    id: orgId,
    slug: 'ofogh-roshan-pars',
    name: 'شرکت توسعه تجارت بین‌المللی افق روشن پارس',
    organization_type: 'trading',
    national_id: '۱۰۱۰۱۲۳۴۵۶۷',
    registration_number: '۱۲۳۴۵۶',
    economic_code: '۴۱۱۱۲۳۴۵۶۷۸۹',
    ceo_name: 'آرمان نیک‌خواه',
    representative_name: 'سارا احمدی',
    representative_phone: '۰۹۱۲۰۰۰۰۰۰۰',
    description: 'تأمین و صادرات محصولات صنعتی با شبکه همکاری در بازارهای منطقه.',
    province_id: 1,
    province_name: 'تهران',
    city_id: 1,
    city_name: 'تهران',
    address: 'تهران، خیابان ولیعصر، بالاتر از میدان ونک، ساختمان بازرگانی افق، طبقه پنجم',
    phone: '۰۲۱۸۸۸۸۸۸۸۸',
    email: 'contact@ofogh-roshan.example',
    website: 'https://ofogh-roshan.example',
    verification_status: mode.status,
    rejection_reason: dashboard().rejection_reason,
    is_verified: mode.status === 'verified',
    is_active: true,
    role: 'owner',
  }
}

function individualProfile() {
  return {
    id: 1,
    display_name: 'سارا احمدی',
    professional_title: 'مشاور توسعه صادرات و بازارهای منطقه',
    bio: 'پژوهشگر و مشاور بازرگانی بین‌المللی با تجربه همکاری با تولیدکنندگان و صادرکنندگان ایرانی.',
    province_id: 1,
    province_name: 'تهران',
    city_id: 1,
    city_name: 'تهران',
    public_phone: '۰۹۱۲۰۰۰۰۰۰۰',
    public_email: 'sara@example.com',
    is_public: true,
    verification_status: mode.status,
    rejection_reason: dashboard().rejection_reason,
  }
}

function documents() {
  if (mode.kind === 'individual') {
    return [
      { id: 8, document_type: 'identity', review_status: 'pending', rejection_reason: '', created_at: '2026-11-21T10:20:00Z' },
    ]
  }
  return [
    { id: 1, document_type: 'registration', review_status: 'rejected', rejection_reason: 'صفحه دوم آگهی ثبت ناقص است و مهر اداره ثبت خوانده نمی‌شود.', created_at: '2026-11-20T10:20:00Z' },
    { id: 2, document_type: 'national_id', review_status: 'approved', rejection_reason: '', created_at: '2026-11-19T10:20:00Z' },
    { id: 3, document_type: 'tax', review_status: 'pending', rejection_reason: '', created_at: '2026-11-21T10:20:00Z' },
  ]
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8000')
  const path = url.pathname.replace(/^\/api/, '')
  if (url.pathname === '/__mode') {
    mode = { kind: url.searchParams.get('kind') || mode.kind, status: url.searchParams.get('status') || mode.status }
    send(res, 200, mode)
    return
  }
  if (path === '/v1/auth/me') return send(res, 200, {
    email: 'sara@example.com', phone: '09120000000', first_name: 'سارا', last_name: 'احمدی',
    date_joined: '2025-01-01T00:00:00Z', province_id: 1, province_name: 'تهران', city_id: 1, city_name: 'تهران',
  })
  if (path === '/v1/business/identities') return send(res, 200, { identities: [identity()], active: identity() })
  if (path === '/v1/business/dashboard') return send(res, 200, dashboard())
  if (path.startsWith('/v1/business/listings')) return send(res, 200, { results: [], count: 0 })
  if (path === '/v1/services/inquiries/received' || path === '/v1/services/inquiries/submitted') return send(res, 200, [])
  if (path === `/v1/business/organizations/${orgId}`) return send(res, 200, organizationProfile())
  if (path === '/v1/business/individual') return send(res, 200, individualProfile())
  if (path === '/v1/business/documents') return send(res, 200, documents())
  if (path === '/v1/geography/provinces/') return send(res, 200, [{ id: 1, name_fa: 'تهران' }, { id: 2, name_fa: 'اصفهان' }])
  if (path === '/v1/inquiries/notifications/list') return send(res, 200, { unread_count: 0, results: [] })
  if (path === '/v1/auth/csrf') return send(res, 200, { csrf_token: 'visual-test' })
  return send(res, 404, { error: { message: `No visual mock for ${path}` } })
}).listen(8000, '127.0.0.1', () => process.stdout.write('visual mock API listening on 8000\n'))
