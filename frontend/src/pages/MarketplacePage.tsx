import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'
import type { Element } from '../api/types'

export function MarketplacePage() {
  const [items, setItems] = useState<Element[]>([])

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/creators/marketplace/list?tag=marketplace`)
      .then((r) => r.json())
      .then((data: Element[]) => setItems(data))
      .catch(() => setItems([]))
  }, [])

  return (
    <div className="page">
      <header className="page__header">
        <h1>Marketplace</h1>
        <Link to="/elements">Elements</Link>
      </header>
      <p className="muted">Elements tagged <code>marketplace</code>.</p>
      <ul>
        {items.map((e) => (
          <li key={e.id}>
            <Link to={`/elements/${e.id}`}>{e.title || e.id}</Link>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="muted">None listed.</p> : null}
    </div>
  )
}
