import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'

type Toast = { id: number; message: string; tone: 'success' | 'error' }
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000)
  }, [])
  return <ToastContext.Provider value={notify}>{children}<div className="toast-stack" aria-live="polite">{toasts.map((toast) =>
    <div className={`toast toast-${toast.tone}`} key={toast.id}>{toast.tone === 'success' ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}<span>{toast.message}</span><button className="icon-button" aria-label="بستن اعلان" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={16} /></button></div>
  )}</div></ToastContext.Provider>
}

export const useToast = () => useContext(ToastContext)
