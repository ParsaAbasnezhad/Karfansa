import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState } from '@tanstack/react-table'
import { ArrowDownToLine, ArrowLeft, ChevronLeft, ChevronRight, Filter, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { API_ROOT, ApiError } from '@/api/client'
import { resourceApi } from '@/api/resources'
import type { ResourceDescriptor, ResourceRecord } from '@/api/types'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Loading } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { formatValue, numberFormat } from '@/lib/format'
import { useResources } from '@/layouts/ControlLayout'

function fieldLabel(descriptor: ResourceDescriptor, name: string) { return descriptor.fields.find((field) => field.name === name)?.label ?? name }

export default function ResourceListPage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const notify = useToast()
  const descriptors = useResources()
  const descriptor = descriptors.data?.find((item) => item.slug === slug)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('page_size')) || 20))
  const q = searchParams.get('q') ?? ''
  const ordering = searchParams.get('ordering') ?? ''
  const [searchInput, setSearchInput] = useState(q)
  const [selection, setSelection] = useState<RowSelectionState>({})
  const [showFilters, setShowFilters] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({})
  const [pendingAction, setPendingAction] = useState<{ key: string; label: string; ids: string[]; requiresReason?: boolean; tone?: string } | null>(null)
  const [reason, setReason] = useState('')
  const query = useQuery({ queryKey: ['resource', slug, searchParams.toString()], enabled: !!descriptor, queryFn: ({ signal }) => {
    const filters: Record<string, string | number> = { page, page_size: pageSize, q, ordering }
    descriptor?.filter_fields?.forEach((name) => { const value = searchParams.get(name); if (value) filters[name] = value })
    return resourceApi.list(slug, filters, signal)
  } })

  useEffect(() => { setSearchInput(q) }, [q])
  useEffect(() => { const handle = window.setTimeout(() => { if (searchInput !== q) updateParam('q', searchInput) }, 350); return () => window.clearTimeout(handle) }, [searchInput, q])
  useEffect(() => { setSelection({}) }, [slug, searchParams])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const fields = descriptor?.list_fields?.length ? descriptor.list_fields : descriptor?.fields.filter((field) => !field.read_only).slice(0, 5).map((field) => field.name) ?? []
  const columns = useMemo<ColumnDef<ResourceRecord>[]>(() => [
    { id: 'select', header: ({ table }) => <input type="checkbox" aria-label="انتخاب همه ردیف‌های صفحه" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />, cell: ({ row }) => <input type="checkbox" aria-label={`انتخاب ردیف ${row.original.id}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} /> },
    ...fields.filter((name) => visibleColumns[name] !== false).map((name): ColumnDef<ResourceRecord> => ({ id: name, accessorKey: name, header: () => <button className="column-sort" onClick={() => updateParam('ordering', ordering === name ? `-${name}` : name)}>{fieldLabel(descriptor!, name)}<span>{ordering === name ? '↑' : ordering === `-${name}` ? '↓' : '↕'}</span></button>, cell: ({ row }) => <span className={name.includes('status') ? 'status-pill' : ''}>{formatValue(row.original[name])}</span> })),
    { id: 'open', header: 'پرونده', cell: ({ row }) => <Link className="table-open" to={`/resources/${slug}/${row.original.id}`} aria-label={`مشاهده ردیف ${row.original.id}`}><ArrowLeft size={17} /></Link> },
  ], [descriptor, fields.join(','), slug, visibleColumns, ordering, searchParams])
  const table = useReactTable({ data: query.data?.items ?? [], columns, state: { rowSelection: selection }, onRowSelectionChange: setSelection, getRowId: (row) => String(row.id), getCoreRowModel: getCoreRowModel(), manualPagination: true, manualSorting: true })
  const selectedIds = Object.keys(selection).filter((id) => selection[id])
  const actionMutation = useMutation({ mutationFn: ({ key, ids, reason }: { key: string; ids: string[]; reason: string }) =>
    resourceApi.bulk(slug, ids, key, reason), onSuccess: (result) => {
    notify(`${numberFormat.format(result.processed)} مورد با موفقیت به‌روزرسانی شد.`)
    setPendingAction(null); setReason(''); setSelection({}); void queryClient.invalidateQueries({ queryKey: ['resource', slug] })
  }, onError: (error) => notify(error instanceof Error ? error.message : 'عملیات انجام نشد.', 'error') })

  async function exportCsv() {
    try {
      const filters = new URLSearchParams(searchParams)
      const response = await fetch(`${API_ROOT}/resources/${encodeURIComponent(slug)}/export.csv?${filters}`, { credentials: 'include', cache: 'no-store' })
      if (!response.ok) throw new ApiError(response.status, 'دریافت خروجی انجام نشد.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${slug}.csv`; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('خروجی دریافت شد.')
    } catch (error) { notify(error instanceof Error ? error.message : 'دریافت خروجی انجام نشد.', 'error') }
  }

  if (descriptors.isPending) return <Loading />
  if (descriptors.isError) return <ErrorState error={descriptors.error} retry={() => void descriptors.refetch()} />
  if (!descriptor || !(descriptor.permissions?.view ?? descriptor.can_view ?? true)) return <EmptyState title="این بخش در دسترس نیست" detail="برای مشاهده این بخش مجوز لازم است." />

  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">مدیریت داده‌ها</div><h1>{descriptor.title}</h1><p>جستجو، بررسی و مدیریت پرونده‌های این بخش</p></div><div className="heading-actions">{(descriptor.permissions?.export ?? descriptor.can_export) && <Button variant="secondary" onClick={() => void exportCsv()}><ArrowDownToLine size={17} /> خروجی CSV</Button>}{(descriptor.permissions?.create ?? descriptor.can_create) && <Link className="button button-primary" to={`/resources/${slug}/new`}><Plus size={17} /> افزودن</Link>}</div></div>
    <Card className="list-card"><div className="list-toolbar"><div className="search-input"><Search size={18} /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="جستجو در پرونده‌ها…" aria-label="جستجو" /></div><div className="toolbar-actions"><Button variant="secondary" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}><Filter size={17} /> فیلتر</Button><details className="column-menu"><summary className="button button-secondary"><SlidersHorizontal size={17} /> ستون‌ها</summary><div>{fields.map((field) => <label key={field}><input type="checkbox" checked={visibleColumns[field] !== false} onChange={(event) => setVisibleColumns((current) => ({ ...current, [field]: event.target.checked }))} /> {fieldLabel(descriptor, field)}</label>)}</div></details></div></div>
      {showFilters && <div className="filter-panel">{descriptor.filter_fields?.map((name) => { const field = descriptor.fields.find((item) => item.name === name); return <label key={name}>{field?.label ?? name}{field?.choices?.length ? <select value={searchParams.get(name) ?? ''} onChange={(event) => updateParam(name, event.target.value)}><option value="">همه</option>{field.choices.map((choice) => <option key={String(choice.value)} value={String(choice.value)}>{choice.label}</option>)}</select> : <Input value={searchParams.get(name) ?? ''} onChange={(event) => updateParam(name, event.target.value)} />}</label> })}</div>}
      {selectedIds.length > 0 && <div className="selection-bar"><strong>{numberFormat.format(selectedIds.length)} مورد انتخاب شده</strong><div>{descriptor.actions?.map((action) => <Button key={action.key} variant={action.tone === 'danger' ? 'danger' : 'secondary'} disabled={selectedIds.length > 100} onClick={() => setPendingAction({ ...action, ids: selectedIds })}>{action.label}</Button>)}{(descriptor.permissions?.delete ?? descriptor.can_delete) && <Button variant="danger" disabled={selectedIds.length > 100} onClick={() => setPendingAction({ key: 'delete', label: 'حذف گروهی', tone: 'danger', ids: selectedIds })}><Trash2 size={15} /> حذف انتخاب‌شده‌ها</Button>}{selectedIds.length > 100 && <small>برای عملیات گروهی حداکثر ۱۰۰ مورد را انتخاب کنید.</small>}</div></div>}
      {query.isPending ? <Loading /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data.items.length === 0 ? <EmptyState title="پرونده‌ای پیدا نشد" detail={q ? 'عبارت جستجو یا فیلترها را تغییر دهید.' : 'هنوز داده‌ای برای این بخش ثبت نشده است.'} /> : <div className="table-scroll"><table className="data-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div>}
      {query.data && <div className="table-footer"><span>{numberFormat.format(query.data.total)} پرونده</span><div><Button variant="ghost" disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))} aria-label="صفحه قبل"><ChevronRight size={18} /></Button><span>صفحه {numberFormat.format(page)} از {numberFormat.format(Math.max(1, Math.ceil(query.data.total / pageSize)))}</span><Button variant="ghost" disabled={page * pageSize >= query.data.total} onClick={() => updateParam('page', String(page + 1))} aria-label="صفحه بعد"><ChevronLeft size={18} /></Button></div><select aria-label="تعداد ردیف در صفحه" value={pageSize} onChange={(event) => updateParam('page_size', event.target.value)}><option value="20">۲۰ ردیف</option><option value="50">۵۰ ردیف</option><option value="100">۱۰۰ ردیف</option></select></div>}
    </Card>
    <ConfirmDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) { setPendingAction(null); setReason('') } }} title={`تأیید ${pendingAction?.label ?? 'عملیات'}`} description={`این عملیات برای ${numberFormat.format(pendingAction?.ids.length ?? 0)} پرونده ثبت و در تاریخچه مدیریتی ثبت می‌شود.`} confirmLabel="تأیید و اجرا" onConfirm={() => pendingAction && actionMutation.mutate({ key: pendingAction.key, ids: pendingAction.ids, reason })} busy={actionMutation.isPending} danger={pendingAction?.tone === 'danger'} confirmDisabled={!!pendingAction?.requiresReason && !reason.trim()}>{pendingAction?.requiresReason && <label className="dialog-field">دلیل تصمیم<Input value={reason} onChange={(event) => setReason(event.target.value)} autoFocus /></label>}</ConfirmDialog>
  </div>
}
