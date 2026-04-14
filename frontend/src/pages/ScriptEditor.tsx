import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'
import type { Element } from '../api/types'

export function ScriptEditor() {
  const { id } = useParams<{ id: string }>()
  const [el, setEl] = useState<Element | null>(null)
  const [content, setContent] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${getApiBaseUrl()}/elements/${id}`)
      .then((r) => r.json())
      .then((data: Element) => {
        setEl(data)
        setContent(data.content)
      })
      .catch((e: Error) => setErr(e.message))
  }, [id])

  async function save() {
    if (!id) return
    const res = await fetch(`${getApiBaseUrl()}/elements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) setErr(await res.text())
    else setErr(null)
  }

  if (!id) return null
  if (err) return <p className="error">{err}</p>
  if (!el) return <p>Loading…</p>

  return (
    <div className="page">
      <header className="page__header">
        <h1>Script editor</h1>
        <Link to={`/elements/${id}`}>Element</Link>
      </header>
      <p className="muted">{el.type_hint}</p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={18}
        style={{ width: '100%', fontFamily: 'inherit' }}
      />
      <div className="row" style={{ marginTop: '0.75rem' }}>
        <button type="button" onClick={() => void save()}>
          Save
        </button>
      </div>
    </div>
  )
}
