import { useState } from 'react'

interface Props {
  onUpdate: () => Promise<void>
}

export function PwaUpdateNotice({ onUpdate }: Props) {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(false)

  const update = async () => {
    setUpdating(true)
    setError(false)
    try {
      await onUpdate()
    } catch (reason) {
      console.error('The Karfansa application update could not be applied.', reason)
      setError(true)
      setUpdating(false)
    }
  }

  return (
    <aside className="pwa-update-notice" dir="rtl" role="status" aria-live="polite">
      <span>
        {error ? 'به‌روزرسانی انجام نشد. دوباره تلاش کنید.' : 'نسخه جدید کارفنسا آماده است.'}
      </span>
      <button type="button" onClick={() => void update()} disabled={updating}>
        {updating ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}
      </button>
    </aside>
  )
}
