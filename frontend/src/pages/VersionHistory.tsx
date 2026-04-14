import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'

type VerRow = {
  id: string
  version_number: number
  created_at: string
  snapshot: Record<string, unknown>
}

export function VersionHistory() {
  const { id } = useParams<{ id: string }>()
  const [rows, setRows] = useState<VerRow[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${getApiBaseUrl()}/elements/${id}/versions`)
      .then((r) => r.json())
      .then((data: VerRow[]) => setRows(data))
      .catch((e: Error) => setErr(e.message))
  }, [id])

  if (!id) return null
  if (err) return <p className="error">{err}</p>

  return (
    <div className="page">
      <header className="page__header">
        <h1>Version history</h1>
        <Link to={`/elements/${id}`}>Element</Link>
      </header>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((r) => (
          <li key={r.id} style={{ borderBottom: '1px solid #252a34', padding: '0.5rem 0' }}>
            <strong>v{r.version_number}</strong>{' '}
            <span className="muted">{r.created_at}</span>
            <pre className="detail__content" style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
              {JSON.stringify(r.snapshot, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="muted">No history yet (edit the element first).</p> : null}
    </div>
  )
}
