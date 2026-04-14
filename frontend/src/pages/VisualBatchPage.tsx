import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'

export function VisualBatchPage() {
  const { id } = useParams<{ id: string }>()
  const [out, setOut] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${getApiBaseUrl()}/visual/prompts/storyboard/${id}/batch`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setOut(JSON.stringify(d, null, 2)))
      .catch(() => setOut('error'))
  }, [id])

  if (!id) return null

  return (
    <div className="page">
      <header className="page__header">
        <h1>Visual batch prompts</h1>
        <Link to={`/elements/${id}`}>Element</Link>
      </header>
      {out ? <pre className="detail__content">{out}</pre> : <p>Loading…</p>}
    </div>
  )
}
