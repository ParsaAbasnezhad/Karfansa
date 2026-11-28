import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button button-${variant} ${className}`} {...props} />
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`input ${className}`} {...props} />
  },
)

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function EmptyState({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">◇</span><h3>{title}</h3>{detail && <p>{detail}</p>}{action}</div>
}

export function Loading({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" />{label}</div>
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return <EmptyState title="دریافت اطلاعات انجام نشد" detail={error instanceof Error ? error.message : 'دوباره تلاش کنید.'} action={retry && <Button onClick={retry}>تلاش مجدد</Button>} />
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, busy = false, danger = false, confirmDisabled = false, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel: string; onConfirm: () => void; busy?: boolean; danger?: boolean; confirmDisabled?: boolean; children?: ReactNode
}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content" dir="rtl">
      <Dialog.Title className="dialog-title">{title}</Dialog.Title><Dialog.Description className="muted">{description}</Dialog.Description>
      {children}<div className="dialog-actions"><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy || confirmDisabled}>{busy ? 'در حال انجام…' : confirmLabel}</Button><Dialog.Close asChild><Button variant="secondary">انصراف</Button></Dialog.Close></div>
      <Dialog.Close className="icon-button dialog-close" aria-label="بستن"><X size={18} /></Dialog.Close>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}
