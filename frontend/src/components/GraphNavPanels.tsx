import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchRelationBundle } from '../api/client'
import type { Relation } from '../api/types'

type Props = { elementId: string }

export function GraphNavPanels({ elementId }: Props) {
  const [upstream, setUpstream] = useState<Relation[]>([])
  const [downstream, setDownstream] = useState<Relation[]>([])

  useEffect(() => {
    let cancelled = false
    fetchRelationBundle(elementId)
      .then((b) => {
        if (!cancelled) {
          setUpstream(b.upstream)
          setDownstream(b.downstream)
        }
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [elementId])

  return (
    <section className="section graph-nav">
      <h2>Graph navigation</h2>
      <div className="graph-cols">
        <div>
          <h3>Upstream</h3>
          <ul>
            {upstream.map((r) => (
              <li key={r.id}>
                <Link to={`/elements/${r.parent_id}`}>{r.parent_id}</Link>
                <span className="muted"> · {r.relation_type}</span>
              </li>
            ))}
            {upstream.length === 0 ? <li className="muted">None</li> : null}
          </ul>
        </div>
        <div>
          <h3>Downstream</h3>
          <ul>
            {downstream.map((r) => (
              <li key={r.id}>
                <Link to={`/elements/${r.child_id}`}>{r.child_id}</Link>
                <span className="muted"> · {r.relation_type}</span>
              </li>
            ))}
            {downstream.length === 0 ? <li className="muted">None</li> : null}
          </ul>
        </div>
      </div>
      <p>
        <Link to={`/graph?root=${elementId}`}>Open graph explorer →</Link>
      </p>
    </section>
  )
}
