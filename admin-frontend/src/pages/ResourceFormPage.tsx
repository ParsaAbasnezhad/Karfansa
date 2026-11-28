import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Save, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { resourceApi } from '@/api/resources'
import type { ResourceField } from '@/api/types'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Loading } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { FieldControl, type FieldValue } from '@/components/FieldControl'
import { useResources } from '@/layouts/ControlLayout'

type Values = Record<string, FieldValue>

function normalizeInitial(value: unknown): FieldValue {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return (value as FieldValue) ?? null
  if (Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number')) return value as Array<string | number>
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) return String((value as { id: unknown }).id)
  return ''
}

export default function ResourceFormPage() {
  const { slug = '', id } = useParams()
  const editing = !!id
  const descriptors = useResources()
  const descriptor = descriptors.data?.find((item) => item.slug === slug)
  const record = useQuery({ queryKey: ['resource-detail', slug, id], queryFn: ({ signal }) => resourceApi.get(slug, id!, signal), enabled: editing && !!descriptor })
  const { watch, setValue, reset, handleSubmit, formState: { isDirty } } = useForm<Values>({ defaultValues: {} })
  const values = watch()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({})
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && !saved && currentLocation.pathname !== nextLocation.pathname)

  const uploadable = descriptor?.uploadable_fields ?? []

  useEffect(() => {
    if (!descriptor || (editing && !record.data)) return
    const initial: Values = {}
    for (const field of descriptor.fields) {
      if (field.read_only || field.type === 'readonly' || field.type === 'file') continue
      const raw = normalizeInitial(record.data?.[field.name])
      if (field.type === 'boolean') initial[field.name] = raw === null ? false : raw
      else if (field.type === 'number') initial[field.name] = raw === null ? null : raw
      else initial[field.name] = raw ?? null
    }
    reset(initial)
  }, [descriptor, editing, record.data, reset])

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const fileEntries = Object.entries(fileValues).filter((entry): entry is [string, File] => entry[1] != null)
      if (fileEntries.length > 0) {
        // Upload files atomically with the record.
        return resourceApi.multipart(slug, editing ? id! : null, payload, fileEntries, editing ? 'PATCH' : 'POST')
      }
      return editing ? resourceApi.update(slug, id!, payload) : resourceApi.create(slug, payload)
    },
    onSuccess: (result) => {
      setSaved(true)
      notify(editing ? 'پرونده به‌روزرسانی شد.' : 'پرونده ثبت شد.')
      void queryClient.invalidateQueries({ queryKey: ['resource', slug] })
      navigate(`/resources/${slug}/${result.id ?? id}`, { replace: true })
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'ثبت اطلاعات انجام نشد.', 'error'),
  })

  if (descriptors.isPending || (editing && record.isPending)) return <Loading />
  if (descriptors.isError) return <ErrorState error={descriptors.error} retry={() => void descriptors.refetch()} />
  if (!descriptor || !(editing ? descriptor.permissions?.update ?? descriptor.can_update : descriptor.permissions?.create ?? descriptor.can_create)) return <EmptyState title="دسترسی به این فرم مجاز نیست" />
  if (record.isError) return <ErrorState error={record.error} retry={() => void record.refetch()} />

  const fields: ResourceField[] = descriptor.fields.filter((field) => !field.read_only && field.type !== 'readonly' && field.type !== 'file')
  const fileFields: ResourceField[] = descriptor.fields.filter((field) => field.type === 'file' && uploadable.includes(field.name))

  function submit(formValues: Values) {
    const schemaShape: Record<string, z.ZodType> = {}
    fields.forEach((field) => {
      let schema: z.ZodType = field.multiple
        ? z.array(z.union([z.string(), z.number()]))
        : field.type === 'number' ? z.number().nullable() : field.type === 'boolean' ? z.boolean() : z.string().nullable()
      if (field.required) schema = schema.refine((value) => Array.isArray(value) ? value.length > 0 : value !== '' && value !== null && value !== undefined, 'این فیلد الزامی است.')
      schemaShape[field.name] = schema
    })
    const result = z.object(schemaShape).safeParse(formValues)
    if (!result.success) {
      const next: Record<string, string> = {}
      for (const issue of result.error.issues) next[String(issue.path[0])] = issue.message
      setErrors(next)
      return
    }
    setErrors({})
    const payload: Record<string, unknown> = {}
    for (const field of fields) payload[field.name] = result.data[field.name] === '' && !field.required ? null : result.data[field.name]
    mutation.mutate(payload)
  }

  return <div className="page-stack"><div className="page-heading"><div><Link className="back-link" to={editing ? `/resources/${slug}/${id}` : `/resources/${slug}`}><ArrowRight size={17} /> بازگشت</Link><h1>{editing ? `ویرایش ${descriptor.singular ?? descriptor.title}` : `افزودن ${descriptor.singular ?? descriptor.title}`}</h1><p>فیلدهای مجاز این بخش را تکمیل کنید.</p></div></div>
    <form onSubmit={handleSubmit(submit)}><Card className="form-card"><div className="section-head"><h2>اطلاعات پرونده</h2><span>{fields.length + fileFields.length} فیلد</span></div>{fields.length + fileFields.length === 0 ? <EmptyState title="فیلد قابل ویرایش وجود ندارد" /> : <div className="form-grid">{fields.map((field) => <div className={`form-field ${field.type === 'textarea' ? 'wide' : ''}`} key={field.name}><label htmlFor={`field-${field.name}`}>{field.label}{field.required && <span className="required">*</span>}</label><FieldControl field={field} value={values[field.name] ?? null} id={`field-${field.name}`} onChange={(value) => { setValue(field.name, value, { shouldDirty: true }); setErrors((current) => ({ ...current, [field.name]: '' })) }} />{field.help_text && field.type !== 'boolean' && <small className="muted">{field.help_text}</small>}{errors[field.name] && <small className="field-error" role="alert">{errors[field.name]}</small>}</div>)}
      {fileFields.map((field) => <div className={`form-field wide`} key={field.name}><label htmlFor={`field-${field.name}`}>{field.label}</label>
        <div className="file-upload-control"><label className="button button-secondary"><Upload size={17} /> {fileValues[field.name] ? 'تغییر فایل' : 'انتخاب فایل'}<Input id={`field-${field.name}`} type="file" hidden onChange={(event) => setFileValues((current) => ({ ...current, [field.name]: event.target.files?.[0] ?? null }))} /></label>{fileValues[field.name] && <span className="file-chip">{fileValues[field.name]!.name}<button type="button" onClick={() => setFileValues((current) => ({ ...current, [field.name]: null }))} aria-label="حذف فایل"><X size={14} /></button></span>}</div>
        {editing && typeof record.data?.[field.name] === 'string' && <small className="muted">فایل فعلی ثبت شده است؛ انتخاب فایل جدید جایگزین آن می‌شود.</small>}
      </div>)}
    </div>}</Card><div className="form-footer"><Link className="button button-secondary" to={editing ? `/resources/${slug}/${id}` : `/resources/${slug}`}>انصراف</Link><Button type="submit" disabled={mutation.isPending || fields.length + fileFields.length === 0}><Save size={18} /> {mutation.isPending ? 'در حال ثبت…' : 'ذخیره اطلاعات'}</Button></div></form>
    <ConfirmDialog open={blocker.state === 'blocked'} onOpenChange={(open) => { if (!open) blocker.reset?.() }} title="تغییرات ذخیره نشده" description="اطلاعات وارد شده هنوز ذخیره نشده‌اند. از این صفحه خارج می‌شوید؟" confirmLabel="خروج از صفحه" danger onConfirm={() => blocker.proceed?.()} />
  </div>
}
