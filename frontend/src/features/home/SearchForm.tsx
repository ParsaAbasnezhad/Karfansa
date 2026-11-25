import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '@/components/toast-context'
import { Icon } from './icons'

interface Props {
  /** "masthead" is the large desktop search box, "drawer" the one inside the mobile menu. */
  variant: 'masthead' | 'drawer'
  /** Called after a search was submitted (the drawer uses it to close). */
  onDone?: () => void
}

export function SearchForm({ variant, onDone }: Props) {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const [text, setText] = useState(params.get('q') ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q) {
      toast('عبارتی برای جستجو وارد کنید.')
      return
    }
    navigate(`/search?q=${encodeURIComponent(q)}`)
    onDone?.()
  }

  if (variant === 'drawer') {
    return (
      <form className="dsearch" role="search" onSubmit={submit}>
        <Icon name="search" />
        <input
          id="dq"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="جستجو در شرکت‌ها و فرصت‌های تجاری..."
          aria-label="جستجو"
        />
      </form>
    )
  }

  return (
    <form className="search" role="search" onSubmit={submit}>
      <Icon name="search" />
      <input
        id="q"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="جستجو در شرکت‌ها، فرصت‌های تجاری و نمادهای بورسی..."
        aria-label="جستجو"
      />
      <kbd>/</kbd>
      <button className="go" type="submit" aria-label="جستجو">
        <Icon name="arrow-l" />
      </button>
    </form>
  )
}
