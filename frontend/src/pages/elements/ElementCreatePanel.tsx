import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createElement } from '../../api/client'
import type { Element } from '../../api/types'
import { ElementSlotForm } from '../../components/ElementSlotForm'
import { TagChipsInput } from '../../components/TagChipsInput'
import { UPSTREAM_IDS_KEY, UpstreamElementsField } from '../../components/UpstreamElementsField'
import {
  IconAlignLeft,
  IconArrowLeft,
  IconSave,
  IconTag,
  IconType,
  IconUser,
  TypeGlyph,
} from '../../components/ui/icons'
import { ELEMENT_TYPE_OPTIONS } from '../../constants/elementTypes'
import {
  getSlotsMap,
  getViewConfig,
  mergeSlotsForType,
} from '../../domain/elementSlots'
import { useElementsData } from '../../context/ElementsDataContext'
import { handleFormEnterToSubmitKeyDown, notifySuccess } from '../../notify'
import { loadSettings } from '../../settings/settingsStorage'

export function ElementCreatePanel() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { refresh, elements } = useElementsData()
  const [title, setTitle] = useState('')
  const [typeHint, setTypeHint] = useState('Idea')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [author, setAuthor] = useState(() => loadSettings().defaultAuthorName)
  const [metadata, setMetadata] = useState<Record<string, unknown>>({})
  const [err, setErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const lockedType = useMemo(() => {
    const t = params.get('type')
    return t && ELEMENT_TYPE_OPTIONS.some((o) => o.value === t) ? t : null
  }, [params])

  useEffect(() => {
    if (lockedType) {
      setTypeHint(lockedType)
    }
  }, [lockedType])

  useEffect(() => {
    setMetadata((prev) => {
      const next = { ...prev, slots: mergeSlotsForType(typeHint, getSlotsMap(prev)) }
      if (typeHint !== 'Shot') {
        delete (next as { order?: unknown }).order
      }
      return next
    })
  }, [typeHint])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const tt = title.trim()
    if (!tt) {
      setErr('Title is required.')
      return
    }
    setErr(null)
    setCreating(true)
    try {
      const slotsMerged = mergeSlotsForType(typeHint, getSlotsMap(metadata))
      const metaPayload = { ...metadata, slots: slotsMerged }
      const el = await createElement({
        title: tt,
        type_hint: typeHint,
        content,
        tags: [...tags],
        author: author.trim(),
        metadata: metaPayload,
      })
      await refresh()
      void notifySuccess('Element created', el.title)
      nav(`/elements/${el.id}`, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const viewCfg = getViewConfig(typeHint)
  const upstreamIds = useMemo(() => {
    const raw = metadata[UPSTREAM_IDS_KEY]
    if (!Array.isArray(raw)) return []
    return raw.filter((x): x is string => typeof x === 'string')
  }, [metadata])
  const slotValues = mergeSlotsForType(typeHint, getSlotsMap(metadata)) as Record<string, string>
  const draftElement: Element = {
    id: 'new',
    title: title.trim() || '(untitled)',
    content,
    type_hint: typeHint,
    tags: [...tags],
    metadata,
    author: author.trim(),
    version: 0,
    created_at: '',
    updated_at: '',
  }

  function onSlotChange(key: string, value: string) {
    setMetadata((prev) => ({
      ...prev,
      slots: {
        ...mergeSlotsForType(typeHint, getSlotsMap(prev)),
        [key]: value,
      },
    }))
  }

  function onShotOrderChange(v: string) {
    setMetadata((prev) => {
      const next = { ...prev }
      const n = parseInt(v.trim(), 10)
      if (v.trim() === '' || !Number.isFinite(n)) {
        delete next.order
      } else {
        next.order = n
      }
      return next
    })
  }

  return (
    <div className="elements-main-panel elements-main-panel--editor">
      <header className="elements-main-panel__head">
        <h1 className="elements-main-panel__title icon-label">
          <TypeGlyph type={typeHint} size={22} />
          <span>Create {typeHint}</span>
        </h1>
        <Link to="/elements" className="elements-main-panel__back icon-label">
          <IconArrowLeft size={16} />
          <span>Close</span>
        </Link>
      </header>
      <section className="create-panel element-editor">
        <div className="element-editor__fixed-actions" role="toolbar" aria-label="Create element">
          <button
            type="submit"
            form="element-create-form"
            className="element-editor__save icon-label"
            disabled={creating}
          >
            <IconSave size={16} />
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        <div className="element-editor__head">
          <h3 className="elements-main-panel__sub icon-label element-editor__head-title">
            <IconAlignLeft size={18} />
            <span>Content</span>
          </h3>
          <span className="element-editor__head-placeholder" aria-hidden />
        </div>
        <form
          id="element-create-form"
          className="create-form element-editor__form"
          onKeyDown={handleFormEnterToSubmitKeyDown}
          onSubmit={(e) => void onSubmit(e)}
        >
        <div className="create-form__row element-editor__split">
          <label className="create-form__field">
            <span className="icon-label">
              <IconAlignLeft size={14} />
              Title
            </span>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {lockedType ? null : (
            <label className="create-form__field create-form__field--type">
              <span className="icon-label">
                <IconType size={14} />
                Type
              </span>
              <select value={typeHint} onChange={(e) => setTypeHint(e.target.value)}>
                {ELEMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="create-form__field create-form__field--tags create-form__span-2">
          <span className="icon-label">
            <IconTag size={14} />
            Tags
          </span>
          <TagChipsInput id="create-tags" tags={tags} onChange={setTags} placeholder="Type a word, Space to add; Backspace removes last tag" />
        </label>
        <UpstreamElementsField
          currentTypeHint={typeHint}
          elements={elements}
          value={upstreamIds}
          onChange={(ids) => setMetadata((prev) => ({ ...prev, [UPSTREAM_IDS_KEY]: ids }))}
        />
        <label className="create-form__field create-form__span-2">
          <span>{viewCfg.contentLabel}</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder={viewCfg.contentPlaceholder}
          />
        </label>
        <div className="create-form__span-2">
          <ElementSlotForm
            typeHint={typeHint}
            element={draftElement}
            slotValues={slotValues}
            onSlotChange={onSlotChange}
            shotOrder={typeHint === 'Shot' ? String(metadata.order ?? '') : ''}
            onShotOrderChange={onShotOrderChange}
          />
        </div>
        <div className="create-form__row create-form__row--block">
          <label className="create-form__field">
            <span className="icon-label">
              <IconUser size={14} />
              Author
            </span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
        </div>
        {err ? <p className="error create-form__span-2">{err}</p> : null}
      </form>
      </section>
    </div>
  )
}
