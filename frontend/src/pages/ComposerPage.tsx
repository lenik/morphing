import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'
import { handleFormEnterToSubmitKeyDown, notifySuccess } from '../notify'
import { loadSettings } from '../settings/settingsStorage'

export function ComposerPage() {
  const nav = useNavigate()
  const [title, setTitle] = useState('New story')
  const [storyText, setStoryText] = useState('')
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<{
    title: string
    estimated_elements_by_type: Record<string, number>
    estimated_relation_count: number
    preview_names: Record<string, string[]>
    timeline_nodes: { type_hint: string; items: { name: string; [k: string]: string }[] }[]
  } | null>(null)
  const [activeTypeIdx, setActiveTypeIdx] = useState(-1)
  const [revealedCount, setRevealedCount] = useState<Record<string, number>>({})
  const [overallProgress, setOverallProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  type PreviewData = {
    title: string
    estimated_elements_by_type: Record<string, number>
    estimated_relation_count: number
    preview_names: Record<string, string[]>
    timeline_nodes: { type_hint: string; items: { name: string; [k: string]: string }[] }[]
  }

  function stopTimelineTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function startTimelineAnimation(nodes: { type_hint: string; items: { name: string }[] }[]) {
    stopTimelineTimer()
    setActiveTypeIdx(0)
    setRevealedCount({})
    const totalSteps = nodes.reduce((s, n) => s + Math.max(1, n.items.length), 0)
    let done = 0
    let typeIdx = 0
    let inTypeItemIdx = 0
    timerRef.current = window.setInterval(() => {
      if (typeIdx >= nodes.length) {
        stopTimelineTimer()
        return
      }
      setActiveTypeIdx(typeIdx)
      const node = nodes[typeIdx]
      const itemLen = Math.max(1, node.items.length)
      const nextReveal = Math.min(itemLen, inTypeItemIdx + 1)
      setRevealedCount((prev) => ({ ...prev, [node.type_hint]: nextReveal }))
      inTypeItemIdx += 1
      done += 1
      setOverallProgress(Math.min(92, Math.round((done / totalSteps) * 92)))
      if (inTypeItemIdx >= itemLen) {
        typeIdx += 1
        inTypeItemIdx = 0
      }
    }, 350)
  }

  async function runPreview(): Promise<PreviewData | null> {
    if (!storyText.trim() || previewing) return null
    setErr(null)
    setPreviewing(true)
    try {
      const s = loadSettings()
      const res = await fetch(`${getApiBaseUrl()}/composer/stories/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          story_text: storyText,
          author,
          openai_api_key: s.openaiApiKey || undefined,
          openai_base_url: s.openaiApiBaseUrl || undefined,
          model: s.openaiDefaultModel || undefined,
        }),
      })
      if (!res.ok) {
        setErr(await res.text())
        return null
      }
      const data = (await res.json()) as PreviewData
      setPreview(data)
      setActiveTypeIdx(-1)
      setRevealedCount({})
      setOverallProgress(0)
      return data
    } finally {
      setPreviewing(false)
    }
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setErr(null)
    setSubmitting(true)
    try {
      let previewData = preview
      if (!previewData) {
        previewData = await runPreview()
      }
      if (previewData?.timeline_nodes?.length) {
        startTimelineAnimation(previewData.timeline_nodes)
      }
      const s = loadSettings()
      const res = await fetch(`${getApiBaseUrl()}/composer/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          story_text: storyText,
          author,
          openai_api_key: s.openaiApiKey || undefined,
          openai_base_url: s.openaiApiBaseUrl || undefined,
          model: s.openaiDefaultModel || undefined,
        }),
      })
      if (!res.ok) {
        setErr(await res.text())
        return
      }
      const data = (await res.json()) as {
        story_id: string
        focus_element_id: string
        created_element_ids: string[]
      }
      stopTimelineTimer()
      setActiveTypeIdx(Math.max(0, (previewData?.timeline_nodes?.length || 1) - 1))
      setOverallProgress(100)
      void notifySuccess('Story graph created', `Generated ${data.created_element_ids.length} elements`)
      nav(`/elements/${data.focus_element_id || data.story_id}`)
    } finally {
      stopTimelineTimer()
      setSubmitting(false)
    }
  }

  const timelineNodes = useMemo(() => preview?.timeline_nodes || [], [preview])

  return (
    <div className="page">
      <header className="page__header">
        <h1>Story composer</h1>
        <Link to="/elements">Elements</Link>
      </header>
      <form className="form" onKeyDown={handleFormEnterToSubmitKeyDown} onSubmit={(e) => void submit(e)}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Story content
          <textarea
            value={storyText}
            onChange={(e) => {
              setStoryText(e.target.value)
              setPreview(null)
            }}
            placeholder="Paste or write your story draft. AI will create characters, scenes, script/storyboard/shots and relations."
            rows={14}
          />
        </label>
        <label>
          Author (optional)
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="creator id or name" />
        </label>
        {err ? <p className="error">{err}</p> : null}
        <div className="row" style={{ gap: '0.6rem' }}>
          <button type="button" onClick={() => void runPreview()} disabled={previewing || submitting || !storyText.trim()}>
            {previewing ? 'Analyzing…' : 'Preview graph'}
          </button>
          <button type="submit" disabled={submitting || previewing || !storyText.trim()}>
            {submitting ? 'Creating graph…' : 'Confirm and create graph'}
          </button>
        </div>
        {preview ? (
          <section className="composer-progress">
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Preview</h3>
            <p className="muted" style={{ margin: '0.45rem 0' }}>
              Estimated relations: {preview.estimated_relation_count}
            </p>
            <p style={{ margin: '0.35rem 0' }}>
              {Object.entries(preview.estimated_elements_by_type)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </p>
            <div className="composer-progress__timeline">
              <ol className="composer-progress__line">
                {timelineNodes.map((node, idx) => {
                  const isActive = idx === activeTypeIdx
                  const isDone = idx < activeTypeIdx
                  const visible = revealedCount[node.type_hint] ?? 0
                  return (
                    <li key={node.type_hint} className="composer-progress__node-row">
                      <div className="composer-progress__node-left">
                        <span
                          className={`composer-progress__dot ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                        />
                        <span className={`composer-progress__type ${isActive ? 'is-active' : ''}`}>
                          Type {node.type_hint}
                        </span>
                      </div>
                      <div className="composer-progress__node-right">
                        {(isActive || isDone) &&
                          node.items.slice(0, visible || (isDone ? node.items.length : 0)).map((it, itemIdx) => (
                            <div key={`${node.type_hint}-${itemIdx}`} className="composer-progress__item">
                              <strong>{it.name}</strong>
                              <span className="muted">
                                {[it.personality, it.age, it.location, it.time, it.description].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          ))}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
            <div className="composer-progress__bar-wrap">
              <div className="composer-progress__bar">
                <div className="composer-progress__bar-fill" style={{ width: `${overallProgress}%` }} />
              </div>
              <span className="muted">{overallProgress}%</span>
            </div>
          </section>
        ) : null}
      </form>
    </div>
  )
}
