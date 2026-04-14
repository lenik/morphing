import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getApiBaseUrl } from '../api/baseUrl'
import { useAiChat } from '../context/AiChatContext'
import { handleFormEnterToSubmitKeyDown, notifySuccess } from '../notify'
import { loadSettings } from '../settings/settingsStorage'

export function ComposerPage() {
  const nav = useNavigate()
  const { startOperation, endOperation, pushTrace, pushNote } = useAiChat()
  const [title, setTitle] = useState('New story')
  const [storyText, setStoryText] = useState('')
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const progressScrollRef = useRef<HTMLDivElement | null>(null)
  const [liveOutput, setLiveOutput] = useState('')
  const [liveReasoning, setLiveReasoning] = useState('')
  const [progressOpen, setProgressOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setErr(null)
    setSubmitting(true)
    setProgressOpen(true)
    setOverallProgress(2)
    setLiveOutput('')
    setLiveReasoning('')
    try {
      const s = loadSettings()
      const reqPayload = {
        endpoint: `${getApiBaseUrl()}/composer/stories/stream`,
        method: 'POST',
        body: {
          title,
          story_text: storyText,
          author,
          openai_base_url: s.openaiApiBaseUrl || undefined,
          model: s.openaiDefaultModel || undefined,
        },
      }
      startOperation('Compose', 'Generating story graph from AI stream.', JSON.stringify(reqPayload, null, 2))
      const res = await fetch(`${getApiBaseUrl()}/composer/stories/stream`, {
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
      if (!res.ok || !res.body) {
        setErr((await res.text()) || 'Composer stream failed.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let streamOutput = ''
      let finalData: { story_id: string; focus_element_id: string; created_element_ids: string[] } | null = null
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) continue
          let evt: any
          try {
            evt = JSON.parse(line)
          } catch {
            continue
          }
          if (evt.type === 'delta' && typeof evt.text === 'string') {
            streamOutput += evt.text
            setLiveOutput((prev) => {
              const next = prev + evt.text
              setOverallProgress(Math.min(86, 4 + Math.floor(next.length / 30)))
              return next
            })
          } else if (evt.type === 'reasoning' && typeof evt.text === 'string') {
            setLiveReasoning((prev) => prev + evt.text)
          } else if (evt.type === 'error') {
            throw new Error(String(evt.message || 'Composer stream error'))
          } else if (evt.type === 'final') {
            finalData = evt
          }
        }
      }
      if (!finalData) throw new Error('Composer stream finished without final payload.')
      setOverallProgress(100)
      pushTrace('Compose', {
        summary: `Created ${finalData.created_element_ids.length} elements`,
        key_prompt: JSON.stringify(reqPayload, null, 2),
        assistant_excerpt: streamOutput || JSON.stringify(finalData, null, 2),
      })
      void notifySuccess('Story graph created', `Generated ${finalData.created_element_ids.length} elements`)
      nav(`/elements/${finalData.focus_element_id || finalData.story_id}`)
    } catch (e) {
      setErr((e as Error).message)
      pushNote('Compose', `Failed: ${(e as Error).message}`)
    } finally {
      endOperation()
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!progressOpen) return
    const el = progressScrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [progressOpen, liveOutput, liveReasoning, overallProgress])

  return (
    <div className="page composer-page">
      <header className="page__header">
        <h1>Story composer</h1>
        <Link to="/elements">Elements</Link>
      </header>
      <form className="form composer-form" onKeyDown={handleFormEnterToSubmitKeyDown} onSubmit={(e) => void submit(e)}>
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
          <button type="submit" disabled={submitting || !storyText.trim()}>
            {submitting ? 'Composing…' : 'Compose'}
          </button>
        </div>
      </form>
      {progressOpen ? (
        <div className="composer-modal" role="presentation">
          <div className="composer-modal__backdrop" onClick={() => setProgressOpen(false)} />
          <section className="composer-modal__panel" role="dialog" aria-modal="true" aria-label="AI generating content">
            <header className="composer-modal__head">
              <h3>AI generating content</h3>
              <button type="button" className="button-secondary" onClick={() => setProgressOpen(false)}>
                Close
              </button>
            </header>
            <div className="composer-modal__body" ref={progressScrollRef}>
              <section className="composer-progress">
                <p className="muted">Streaming AI generation (fallback disabled).</p>
                <div className="ai-chat__details-block">
                  <div className="ai-chat__details-label">Model output</div>
                  <pre className="ai-chat__pre ai-chat__pre--bounded">{liveOutput || '(waiting for stream...)'}</pre>
                </div>
                {liveReasoning ? (
                  <div className="ai-chat__details-block">
                    <div className="ai-chat__details-label">Reasoning</div>
                    <pre className="ai-chat__pre ai-chat__pre--bounded">{liveReasoning}</pre>
                  </div>
                ) : null}
              </section>
            </div>
            <footer className="composer-modal__foot">
              <div className="composer-progress__bar-wrap">
                <div className="composer-progress__bar">
                  <div className="composer-progress__bar-fill" style={{ width: `${overallProgress}%` }} />
                </div>
                <span className="muted">{overallProgress}%</span>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  )
}
