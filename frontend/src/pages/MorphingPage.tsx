import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'

export function MorphingPage() {
  const { id } = useParams<{ id: string }>()
  const [note, setNote] = useState('character armor change')
  const [out, setOut] = useState<string | null>(null)

  async function preview() {
    if (!id) return
    const res = await fetch(`${getApiBaseUrl()}/morph/preview/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ change_note: note }),
    })
    setOut(JSON.stringify(await res.json(), null, 2))
  }

  async function approve() {
    if (!id) return
    await fetch(`${getApiBaseUrl()}/morph/approve/${id}`, { method: 'POST' })
  }

  if (!id) return null

  return (
    <div className="page">
      <header className="page__header">
        <h1>Morph preview</h1>
        <Link to={`/elements/${id}`}>Element</Link>
      </header>
      <label className="form">
        Change note
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row" style={{ marginTop: '0.75rem', gap: '0.5rem' }}>
        <button type="button" onClick={() => void preview()}>
          Preview
        </button>
        <button type="button" onClick={() => void approve()}>
          Approve (stub)
        </button>
      </div>
      {out ? (
        <pre className="detail__content" style={{ marginTop: '1rem' }}>
          {out}
        </pre>
      ) : null}
    </div>
  )
}
