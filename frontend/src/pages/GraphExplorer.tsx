import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadSubgraph, type Subgraph } from '../api/client'

type Pos = { x: number; y: number }

function layoutCircle(
  nodeIds: string[],
  w: number,
  h: number,
  pad: number,
): Map<string, Pos> {
  const m = new Map<string, Pos>()
  if (nodeIds.length === 0) return m
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2 - pad
  nodeIds.forEach((id, i) => {
    const a = (i / nodeIds.length) * Math.PI * 2 - Math.PI / 2
    m.set(id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  })
  return m
}

export function GraphExplorer() {
  const [params] = useSearchParams()
  const initial = params.get('root') ?? ''
  const autoAnalyze = params.get('analyze') === '1'
  const [input, setInput] = useState(initial)
  const [data, setData] = useState<Subgraph | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (id: string) => {
    const trimmed = id.trim()
    if (!trimmed) return
    setErr(null)
    setLoading(true)
    try {
      const sg = await loadSubgraph(trimmed, 4, 'both')
      setData(sg)
    } catch (e) {
      setErr((e as Error).message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setInput(initial)
  }, [initial])

  useEffect(() => {
    if (initial) void load(initial)
  }, [initial, load])

  const { positions, nodeMeta, w, h } = useMemo(() => {
    const width = 720
    const height = 480
    const pad = 56
    if (!data || data.nodes.length === 0) {
      return { positions: new Map<string, Pos>(), nodeMeta: new Map<string, string>(), w: width, h: height }
    }
    const ids = [...new Set(data.nodes.map((n) => n.id))]
    const pos = layoutCircle(ids, width, height, pad)
    const meta = new Map(data.nodes.map((n) => [n.id, n.title || n.type_hint || n.id.slice(0, 6)]))
    return { positions: pos, nodeMeta: meta, w: width, h: height }
  }, [data])

  return (
    <div className="page">
      <header className="page__header">
        <h1>Graph</h1>
        <Link to="/elements">Elements</Link>
      </header>
      <div className="row" style={{ marginBottom: '1rem', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Root element id"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <button type="button" disabled={loading} onClick={() => void load(input.trim())}>
          {loading ? 'Loading…' : 'Load'}
        </button>
        {loading && autoAnalyze && initial ? (
          <span className="muted" style={{ fontSize: '0.88rem' }}>
            Running graph analysis…
          </span>
        ) : null}
      </div>
      {err ? <p className="error">{err}</p> : null}
      <div
        style={{
          border: '1px solid #2a3140',
          borderRadius: 8,
          overflow: 'auto',
          background: '#0b0d11',
        }}
      >
        {data && data.nodes.length > 0 ? (
          <svg width={w} height={h} role="img" aria-label="Narrative graph">
            {data.edges.map((e) => {
              const p1 = positions.get(e.parent_id)
              const p2 = positions.get(e.child_id)
              if (!p1 || !p2) return null
              return (
                <line
                  key={e.id}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#3d5080"
                  strokeWidth={1.5}
                />
              )
            })}
            {data.nodes.map((n) => {
              const p = positions.get(n.id)
              if (!p) return null
              const label = nodeMeta.get(n.id) ?? n.id.slice(0, 8)
              return (
                <g key={n.id}>
                  <circle cx={p.x} cy={p.y} r={10} fill="#2c3c64" stroke="#9db7ff" strokeWidth={1} />
                  <text x={p.x} y={p.y + 28} fill="#c5d0e3" fontSize={11} textAnchor="middle">
                    {label.length > 18 ? `${label.slice(0, 18)}…` : label}
                  </text>
                </g>
              )
            })}
          </svg>
        ) : (
          <p className="muted" style={{ padding: '1rem' }}>
            Enter a root element id (from Elements) to visualize its subgraph.
          </p>
        )}
      </div>
    </div>
  )
}
