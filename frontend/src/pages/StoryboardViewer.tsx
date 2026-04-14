import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'
import type { Element } from '../api/types'

export function StoryboardViewer() {
  const { id } = useParams<{ id: string }>()
  const [shots, setShots] = useState<Element[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${getApiBaseUrl()}/storyboards/${id}/shots`)
      .then((r) => r.json())
      .then((data: Element[]) => setShots(data))
      .catch((e: Error) => setErr(e.message))
  }, [id])

  if (!id) return null
  if (err) return <p className="error">{err}</p>

  return (
    <div className="page">
      <header className="page__header">
        <h1>Storyboard</h1>
        <Link to={`/elements/${id}`}>Element</Link>
      </header>
      <ol style={{ paddingLeft: '1.25rem' }}>
        {shots.map((s) => (
          <li key={s.id} style={{ marginBottom: '0.75rem' }}>
            <strong>{s.title || 'Shot'}</strong>
            <pre className="detail__content" style={{ marginTop: '0.35rem' }}>
              {s.content}
            </pre>
          </li>
        ))}
      </ol>
      {shots.length === 0 ? <p className="muted">No shots.</p> : null}
    </div>
  )
}
