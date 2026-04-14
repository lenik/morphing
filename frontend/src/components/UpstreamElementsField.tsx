import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Element } from '../api/types'
import { canBeUpstreamOf, getElementTier } from '../domain/elementTier'
import { ELEMENT_DRAG_MIME } from './TagTreeView'
import { IconGitBranch, IconX, TypeGlyph } from './ui/icons'

export const UPSTREAM_IDS_KEY = 'upstream_element_ids'

type Props = {
  currentElementId?: string
  currentTypeHint: string
  elements: Element[]
  value: string[]
  onChange: (ids: string[]) => void
}

export function UpstreamElementsField({
  currentElementId,
  currentTypeHint,
  elements,
  value,
  onChange,
}: Props) {
  const [draft, setDraft] = useState('')
  const tier = getElementTier(currentTypeHint)

  const candidates = useMemo(() => {
    return elements.filter((e) => {
      if (currentElementId && e.id === currentElementId) return false
      if (value.includes(e.id)) return false
      return canBeUpstreamOf(e.type_hint, currentTypeHint)
    })
  }, [elements, currentElementId, currentTypeHint, value])

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return candidates.slice(0, 24)
    return candidates
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.type_hint.toLowerCase().includes(q),
      )
      .slice(0, 24)
  }, [candidates, draft])

  const datalistId = 'upstream-element-pick'

  function addId(raw: string) {
    const id = raw.trim()
    if (!id) return
    const el = elements.find((e) => e.id === id)
    if (!el || !canBeUpstreamOf(el.type_hint, currentTypeHint)) return
    if (value.includes(id)) return
    onChange([...value, id])
    setDraft('')
  }

  function onPickSuggestion(eid: string) {
    addId(eid)
  }

  function remove(id: string) {
    onChange(value.filter((x) => x !== id))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const raw = e.dataTransfer.getData(ELEMENT_DRAG_MIME) || e.dataTransfer.getData('text/plain')
    addId(raw)
  }

  return (
    <div className="upstream-elements">
      <label className="create-form__field create-form__span-2">
        <span className="icon-label">
          <IconGitBranch size={14} />
          Upstream elements
        </span>
        <span className="upstream-elements__hint muted" style={{ fontSize: '0.82rem' }}>
          Tier {tier} ({currentTypeHint}): only elements with lower tier (earlier in the pipeline). Type to
          autocomplete, or drag a node from the sidebar tree here.
        </span>
        <div
          className="upstream-elements__drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDrop(e)}
        >
          <div className="upstream-elements__chips">
            {value.map((uid) => {
              const el = elements.find((x) => x.id === uid)
              return (
                <span key={uid} className="upstream-elements__chip">
                  <TypeGlyph type={el?.type_hint ?? 'Idea'} size={12} />
                  <Link to={`/elements/${uid}`} className="upstream-elements__chip-link">
                    {el?.title ?? uid.slice(0, 8)}
                  </Link>
                  <button type="button" className="upstream-elements__chip-x" onClick={() => remove(uid)} aria-label="Remove">
                    <IconX size={12} />
                  </button>
                </span>
              )
            })}
          </div>
          <div className="upstream-elements__input-row">
            <input
              className="upstream-elements__input"
              list={datalistId}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search by title or paste element id…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const exact = elements.find(
                    (x) => x.id === draft.trim() || x.title === draft.trim(),
                  )
                  if (exact && canBeUpstreamOf(exact.type_hint, currentTypeHint)) {
                    onPickSuggestion(exact.id)
                  } else if (suggestions.length === 1) {
                    onPickSuggestion(suggestions[0].id)
                  }
                }
              }}
            />
            <datalist id={datalistId}>
              {suggestions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {e.type_hint}
                </option>
              ))}
            </datalist>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                const exact = elements.find((x) => x.id === draft.trim())
                if (exact) addId(exact.id)
              }}
            >
              Add
            </button>
          </div>
        </div>
      </label>
    </div>
  )
}
