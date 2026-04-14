import { useEffect, useRef } from 'react'
import { useAiChat } from '../context/AiChatContext'
import { IconMessageSquare, IconRefreshCw, IconX, IconZap } from './ui/icons'

export function AiChatPanel() {
  const { messages, activeOp, clear } = useAiChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, activeOp])

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

      {activeOp ? (
        <div className="ai-chat__busy" role="status">
          <IconRefreshCw size={16} className="ai-chat__busy-icon ai-chat__busy-icon--spin" />
          <div>
            <div className="ai-chat__busy-label">{activeOp.label}</div>
            <div className="ai-chat__busy-detail">{activeOp.detail}</div>
            {activeOp.promptKey ? (
              <details className="ai-chat__details" open>
                <summary>Sending now (request / prompt)</summary>
                <pre className="ai-chat__pre">{activeOp.promptKey}</pre>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="ai-chat__scroll">
        {messages.length === 0 ? (
          <p className="ai-chat__empty muted">No AI calls yet. AI Complete / Morph / Refactor will show prompts and replies here.</p>
        ) : (
          <ul className="ai-chat__list">
            {messages.map((m) => (
              <li key={m.id} className="ai-chat__msg">
                <div className="ai-chat__msg-title">
                  <IconZap size={13} />
                  <span>{m.title}</span>
                  <time className="ai-chat__time" dateTime={new Date(m.at).toISOString()}>
                    {new Date(m.at).toLocaleTimeString()}
                  </time>
                </div>
                {m.summary ? <p className="ai-chat__summary">{m.summary}</p> : null}
                {m.promptKey ? (
                  <details className="ai-chat__details">
                    <summary>Request / prompt details</summary>
                    <pre className="ai-chat__pre">{m.promptKey}</pre>
                  </details>
                ) : null}
                {m.response ? (
                  <details className="ai-chat__details" open>
                    <summary>Model reply (excerpt)</summary>
                    <pre className="ai-chat__pre">{m.response}</pre>
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
