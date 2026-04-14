import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'
import type { Element } from '../api/types'

export function CreatorDashboard() {
  const { author } = useParams<{ author: string }>()
  const [items, setItems] = useState<Element[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!author) return
    fetch(`${getApiBaseUrl()}/creators/${encodeURIComponent(author)}/elements`)
      .then((r) => r.json())
      .then((data: Element[]) => setItems(data))
      .catch((e: Error) => setErr(e.message))
  }, [author])

  if (!author) return null
  if (err) return <p className="error">{err}</p>

  return (
    <div className="page">
      <header className="page__header">
        <h1>Creator: {author}</h1>
        <Link to="/elements">Elements</Link>
      </header>
      <ul>
        {items.map((e) => (
          <li key={e.id}>
            <Link to={`/elements/${e.id}`}>{e.title || e.id}</Link>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="muted">No elements.</p> : null}
    </div>
  )
}
