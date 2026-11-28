import { useQuery } from '@tanstack/react-query'
import { Activity, Bell, ChevronDown, ChevronLeft, Command, LayoutDashboard, LogOut, Menu, PanelRightClose, PanelRightOpen, Search, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { resourceApi } from '@/api/resources'
import type { ResourceDescriptor } from '@/api/types'
import { Loading } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'

export function useResources() {
  return useQuery({ queryKey: ['resources'], queryFn: ({ signal }) => resourceApi.descriptors(signal), staleTime: 60_000 })
}

function groups(resources: ResourceDescriptor[]) {
  return Object.entries(resources.filter((item) => item.permissions?.view ?? item.can_view ?? true).reduce<Record<string, ResourceDescriptor[]>>((acc, item) => {
    const group = item.group || 'سایر بخش‌ها'
    ;(acc[group] ??= []).push(item)
    return acc
  }, {}))
}

export default function ControlLayout() {
  const { user, signOut } = useAuth()
  const resources = useResources()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const accessibleResources = useMemo(() => resources.data?.filter((item) => item.permissions?.view ?? item.can_view ?? true) ?? [], [resources.data])

  useEffect(() => { setMobileOpen(false); setProfileOpen(false) }, [location.pathname])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((open) => !open) }
      if (event.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { if (paletteOpen) searchRef.current?.focus() }, [paletteOpen])

  const activeResource = accessibleResources.find((item) => location.pathname.startsWith(`/resources/${item.slug}`))
  const title = location.pathname === '/' ? 'نمای کلی' : location.pathname === '/health' ? 'وضعیت سامانه' : location.pathname === '/security' ? 'امنیت و مدیران' : activeResource?.title ?? 'مرکز کنترل'
  const filtered = accessibleResources.filter((item) => `${item.title} ${item.group}`.includes(search.trim()))
  const canManageSecurity = user?.is_superuser || user?.permissions?.includes('management.adminprofile.manage_permissions')

  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    {mobileOpen && <button className="mobile-scrim" aria-label="بستن منو" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`} aria-label="ناوبری مدیریت">
      <div className="sidebar-brand"><Link to="/" className="sidebar-logo"><span className="brand-mark small">ک</span><span className="brand-copy"><strong>Karfansa</strong><small>CONTROL CENTER</small></span></Link><button className="icon-button sidebar-collapse" aria-label={collapsed ? 'بازکردن منو' : 'جمع‌کردن منو'} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}</button><button className="icon-button mobile-only" aria-label="بستن منو" onClick={() => setMobileOpen(false)}><X size={19} /></button></div>
      <nav className="sidebar-nav"><div className="nav-group"><div className="nav-label">مرکز فرمان</div><NavLink end to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={19} /><span>نمای کلی</span></NavLink></div>
        {resources.isPending && <div className="nav-loading"><Loading label="در حال دریافت بخش‌ها…" /></div>}
        {resources.isError && <p className="nav-error">فهرست بخش‌ها در دسترس نیست.</p>}
        {groups(accessibleResources).map(([name, items]) => <div className="nav-group" key={name}><div className="nav-label">{name}</div>{items.map((item) => <NavLink key={item.slug} to={`/resources/${item.slug}`} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={item.title}><span className="nav-initial">{item.title.slice(0, 1)}</span><span>{item.title}</span></NavLink>)}</div>)}
        <div className="nav-group"><div className="nav-label">عملیات</div><NavLink to="/health" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Activity size={19} /><span>وضعیت سامانه</span></NavLink>{canManageSecurity && <NavLink to="/security" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><ShieldCheck size={19} /><span>امنیت و مدیران</span></NavLink>}</div>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-user"><div className="avatar">{(user?.name ?? user?.email ?? 'م').slice(0, 1)}</div><div><strong>{user?.name ?? user?.email ?? 'مدیر'}</strong><small>{user?.is_superuser ? 'مدیر ارشد' : 'مدیر مجاز'}</small></div></div><button className="icon-button sidebar-logout" aria-label="خروج" onClick={() => void signOut()}><LogOut size={18} /></button></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="topbar-leading"><button className="icon-button mobile-only" aria-label="بازکردن منو" onClick={() => setMobileOpen(true)}><Menu size={22} /></button><div className="breadcrumb"><span>مرکز کنترل</span><ChevronLeft size={15} /><strong>{title}</strong></div></div><div className="topbar-actions"><button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="جستجوی بخش‌های مدیریت"><Search size={17} /><span>جستجو در بخش‌ها…</span><kbd>Ctrl K</kbd></button><Link className="icon-button" to="/security?tab=audit" aria-label="فعالیت‌های مدیریتی" title="فعالیت‌های مدیریتی"><Bell size={19} /></Link><div className="profile-wrap"><button className="profile-trigger" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}><div className="avatar tiny">{(user?.name ?? 'م').slice(0, 1)}</div><ChevronDown size={15} /></button>{profileOpen && <div className="profile-menu"><strong>{user?.name ?? user?.email}</strong><small>{user?.email}</small><button onClick={() => void signOut()}><LogOut size={16} /> خروج امن</button></div>}</div></div></header>
      <main className="main-content"><Outlet /></main>
    </div>
    {paletteOpen && <div className="palette-backdrop" onMouseDown={() => setPaletteOpen(false)}><div className="palette" role="dialog" aria-modal="true" aria-label="جستجو در بخش‌ها" onMouseDown={(event) => event.stopPropagation()}><div className="palette-search"><Search size={20} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="نام بخش را جستجو کنید…" aria-label="جستجوی بخش‌ها" /><button className="icon-button" onClick={() => setPaletteOpen(false)} aria-label="بستن"><X size={18} /></button></div><div className="palette-results"><button onClick={() => { navigate('/'); setPaletteOpen(false) }}><LayoutDashboard size={18} /> نمای کلی</button>{filtered.map((item) => <button key={item.slug} onClick={() => { navigate(`/resources/${item.slug}`); setPaletteOpen(false); setSearch('') }}><span className="nav-initial">{item.title.slice(0, 1)}</span>{item.title}<small>{item.group}</small></button>)}{filtered.length === 0 && <p>بخشی با این نام پیدا نشد.</p>}</div><div className="palette-foot"><Command size={14} /> برای دسترسی سریع Ctrl + K را فشار دهید.</div></div></div>}
  </div>
}
