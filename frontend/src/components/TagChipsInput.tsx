import { useCallback, useRef, useState } from 'react'
import { IconTag, IconX } from './ui/icons'

type Props = {
  id?: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
}

/**
 * Space or Enter commits the current token; comma also commits.
 * Backspace with an empty input removes the last chip.
 * Each chip has a remove control.
 */
export function TagChipsInput({ id, tags, onChange, placeholder = 'Type and press Space…', className }: Props) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = useCallback(
    (raw: string) => {
      const t = raw.trim()
      if (!t) return
      if (tags.includes(t)) {
        setDraft('')
        return
      }
      onChange([...tags, t])
      setDraft('')
    },
    [tags, onChange],
  )

  const commitMany = useCallback(
    (parts: string[]) => {
      const next = [...tags]
      for (const p of parts) {
        const t = p.trim()
        if (!t || next.includes(t)) continue
        next.push(t)
      }
      onChange(next)
      setDraft('')
    },
    [tags, onChange],
  )

  function removeAt(index: number) {
    onChange(tags.filter((_, i) => i !== index))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      if (draft.trim()) {
        e.preventDefault()
        commit(draft)
      }
      return
    }
    if (e.key === ',' || e.key === '，') {
      if (draft.trim()) {
        e.preventDefault()
        commit(draft)
      }
      return
    }
    if (e.key === 'Backspace') {
      if (!draft && tags.length > 0) {
        e.preventDefault()
        onChange(tags.slice(0, -1))
      }
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text/plain')
    if (!text || !/[\s,，]/.test(text)) return
    e.preventDefault()
    const parts = text.split(/[\s,，]+/).filter(Boolean)
    if (parts.length === 0) return
    if (draft.trim()) {
      parts.unshift(draft.trim())
    }
    commitMany(parts)
  }

  function onBlur() {
    if (draft.trim()) {
      commit(draft)
    }
  }

  return (
    <div className={`tag-chips-input ${className ?? ''}`.trim()}>
      <div className="tag-chips-input__box" onClick={() => inputRef.current?.focus()}>
        <span className="tag-chips-input__leading icon-label" aria-hidden>
          <IconTag size={14} />
        </span>
        <div className="tag-chips-input__chips">
          {tags.map((t, i) => (
            <span key={`${t}-${i}`} className="tag-chips-input__chip">
              <span className="tag-chips-input__chip-text">{t}</span>
              <button
                type="button"
                className="tag-chips-input__chip-remove"
                onClick={(e) => {
                  e.stopPropagation()
                  removeAt(i)
                }}
                aria-label={`Remove tag ${t}`}
              >
                <IconX size={12} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={id}
            className="tag-chips-input__field"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={onBlur}
            placeholder={tags.length === 0 ? placeholder : ''}
            autoComplete="off"
            aria-label="Add tags"
          />
        </div>
      </div>
    </div>
  )
}
