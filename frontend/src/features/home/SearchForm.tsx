import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'

export function SearchForm({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const navigate = useNavigate()

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    void navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form className="search-form" role="search" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor="product-query">
        نام محصول
      </label>
      <input
        id="product-query"
        className="search-form__input"
        type="search"
        name="q"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        placeholder="نام محصول، مثلاً زعفران"
        autoComplete="off"
        maxLength={100}
        required
      />
      <button className="search-form__button" type="submit">
        جست‌وجو
      </button>
    </form>
  )
}
