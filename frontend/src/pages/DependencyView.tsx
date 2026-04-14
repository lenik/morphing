import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'

export function DependencyView() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<{ downstream_ids: string[]; count: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${getApiBaseUrl()}/dependencies/query/downstream/${id}?depth=12`)
      .then((r) => r.json())
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [id])

  if (!id) return null
  if (err) return <p className="error">{err}</p>
  if (!data) return <p>Loading…</p>

  return (
    <div className="page">
      <header className="page__header">
        <h1>Dependencies</h1>
        <Link to={`/elements/${id}`}>Element</Link>
      </header>
      <p>
        Downstream count: <strong>{data.count}</strong>
      </p>
      <ul>
        {data.downstream_ids.map((x) => (
          <li key={x}>
            <Link to={`/elements/${x}`}>{x}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
