import { useEffect, useRef, useState } from 'react'
import { useAiChat } from '../context/AiChatContext'
import { IconMessageSquare, IconRefreshCw, IconX, IconZap } from './ui/icons'

export function AiChatPanel() {
  const { messages, activeOp, clear } = useAiChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [typedLen, setTypedLen] = useState<Record<string, number>>({})
  const [animatingId, setAnimatingId] = useState<string | null>(null)
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, activeOp])

  useEffect(() => {
    if (!animatingId) return
    // Keep following the newest streamed characters in view.
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [typedLen, animatingId])

  useEffect(() => {
    const newest = [...messages].reverse().find((m) => m.response)
    if (!newest) return
    setExpandedMessageId(newest.id)
    setTypedLen((prev) => {
      if (prev[newest.id] != null) return prev
      const next = { ...prev, [newest.id]: 0 }
      // Ensure prior historical messages are fully visible.
      for (const m of messages) {
        if (!m.response) continue
        if (m.id !== newest.id && next[m.id] == null) next[m.id] = m.response.length
      }
      return next
    })
    setAnimatingId(newest.id)
  }, [messages])

  useEffect(() => {
    if (!activeOp) return
    setExpandedMessageId(activeOp.id)
  }, [activeOp?.id])

  useEffect(() => {
    if (!animatingId) return
    const msg = messages.find((m) => m.id === animatingId && m.response)
    const response = msg?.response ?? ''
    if (!response) return
    if ((typedLen[animatingId] ?? 0) >= response.length) {
      setAnimatingId(null)
      return
    }
    const t = window.setInterval(() => {
      setTypedLen((prev) => {
        const next = { ...prev }
        const cur = next[animatingId] ?? 0
        next[animatingId] = Math.min(response.length, cur + 8)
        return next
      })
    }, 30)
    return () => window.clearInterval(t)
  }, [messages, typedLen, animatingId])

  return (
    <aside className="ai-chat" aria-label="AI activity">
      <div className="ai-chat__head">
        <h2 className="ai-chat__title icon-label">
          <IconMessageSquare size={17} />
          <span>AI</span>
        </h2>
        <button type="button" className="ai-chat__clear" onClick={clear} title="Clear log">
          <IconX size={16} />
        </button>
      </div>

      <div className="ai-chat__scroll">
        {messages.length === 0 && !activeOp ? (
          <p className="ai-chat__empty muted">No AI calls yet. AI Complete / Morph / Refactor will show prompts and replies here.</p>
        ) : (
          <ul className="ai-chat__list">
            {[...messages, ...(activeOp ? [{ id: activeOp.id, at: activeOp.at, title: activeOp.label, summary: activeOp.detail, promptKey: activeOp.promptKey, response: activeOp.liveResponse, reasoning: activeOp.liveReasoning, pending: true }] : [])].map((m: any) => (
              <li key={m.id} className="ai-chat__msg">
                <div className="ai-chat__msg-title">
                  {m.pending ? <IconRefreshCw size={13} className="ai-chat__busy-icon--spin" /> : <IconZap size={13} />}
                  <span>{m.title}</span>
                </div>
                {m.summary ? <p className="ai-chat__summary">{m.summary}</p> : null}
                {m.promptKey || m.response ? (
                  <details
                    className="ai-chat__details"
                    open={expandedMessageId === m.id}
                    onToggle={(e) => {
                      const node = e.currentTarget
                      setExpandedMessageId(node.open ? m.id : null)
                    }}
                  >
                    <summary>Input / output</summary>
                    {m.promptKey ? (
                      <div className="ai-chat__bubble-wrap ai-chat__bubble-wrap--right">
                        <div className="ai-chat__bubble ai-chat__bubble--input">
                          <pre className="ai-chat__pre ai-chat__pre--bounded">{m.promptKey}</pre>
                          <time className="ai-chat__bubble-time" dateTime={new Date(m.at).toISOString()}>
                            {new Date(m.at).toLocaleTimeString()}
                          </time>
                        </div>
                      </div>
                    ) : null}
                    {m.response ? (
                      <div className="ai-chat__bubble-wrap">
                        <div className="ai-chat__bubble">
                        <pre className="ai-chat__pre">
                          {m.response.slice(0, m.id === animatingId ? (typedLen[m.id] ?? 0) : (typedLen[m.id] ?? m.response.length))}
                        </pre>
                          <time className="ai-chat__bubble-time" dateTime={new Date(m.at).toISOString()}>
                            {new Date(m.at).toLocaleTimeString()}
                          </time>
                        </div>
                      </div>
                    ) : null}
                    {m.reasoning ? (
                      <div className="ai-chat__details-block">
                        <div className="ai-chat__details-label">Reasoning</div>
                        <pre className="ai-chat__pre ai-chat__pre--bounded">{m.reasoning}</pre>
                      </div>
                    ) : null}
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
    </aside>
  )
}
