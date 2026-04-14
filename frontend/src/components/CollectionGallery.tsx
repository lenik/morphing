import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Element } from '../api/types'
import {
  createCollection,
  deleteElement,
  fetchCollectionsContaining,
  morphCollectionToType,
  patchCollectionMembers,
} from '../api/client'
import { loadSettings } from '../settings/settingsStorage'
import { useAiChat } from '../context/AiChatContext'
import { useElementsData } from '../context/ElementsDataContext'
import { ELEMENT_DRAG_MIME } from './TagTreeView'
import { IconNetwork, IconPlus, IconX, IconZap, TypeGlyph } from './ui/icons'

const MORPH_TARGETS = ['Character', 'Scene', 'Story', 'Idea', 'Script', 'Storyboard'] as const

type Props = {
  currentElementId: string
  author: string
}

export function CollectionGallery({ currentElementId, author }: Props) {
  const nav = useNavigate()
  const { refresh, upsertElement } = useElementsData()
  const { startOperation, endOperation, pushTrace } = useAiChat()
  const [rows, setRows] = useState<Element[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [morphing, setMorphing] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; collectionId: string } | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const data = await fetchCollectionsContaining(currentElementId)
      setRows(data)
    } catch (e) {
      setErr((e as Error).message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [currentElementId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  async function onCreate() {
    setErr(null)
    try {
      const el = await createCollection({
        title: 'New collection',
        member_ids: [currentElementId],
        author: author.trim(),
      })
      upsertElement(el)
      await load()
      await refresh()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function onDeleteCollection(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Delete this collection element?')) return
    setErr(null)
    try {
      await deleteElement(id)
      await refresh()
      await load()
    } catch (err) {
      setErr((err as Error).message)
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  async function onDropToCollection(collectionId: string, e: React.DragEvent) {
    e.preventDefault()
    const raw = e.dataTransfer.getData(ELEMENT_DRAG_MIME) || e.dataTransfer.getData('text/plain')
    const addId = raw.trim()
    if (!addId || addId === currentElementId) return
    setErr(null)
    try {
      const updated = await patchCollectionMembers(collectionId, { add: [addId] })
      upsertElement(updated)
      await load()
    } catch (err) {
      setErr((err as Error).message)
    }
  }

  async function runMorph(collectionId: string, targetType: string) {
    setMenu(null)
    setMorphing(true)
    setErr(null)
    startOperation(
      'Morph collection',
      `Synthesizing a new ${targetType} from bundled member content (may take up to ~2 minutes).`,
    )
    try {
      const s = loadSettings()
      const { element: el, ai_trace } = await morphCollectionToType(collectionId, {
        target_type: targetType,
        openai_api_key: s.openaiApiKey || undefined,
        openai_base_url: s.openaiApiBaseUrl || undefined,
        model: s.openaiDefaultModel || undefined,
        show_complete_request_to_llm: s.showCompleteRequestMessageToLlm,
      })
      upsertElement(el)
      pushTrace(`Morph → ${targetType}`, ai_trace)
      await refresh()
      nav(`/elements/${el.id}`)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      endOperation()
      setMorphing(false)
    }
  }

  return (
    <section className="collection-gallery">
      {morphing ? (
        <div className="collection-gallery__modal" role="status">
          <div className="collection-gallery__modal-panel">
            <IconZap size={22} />
            <p>Morphing…</p>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              AI is synthesizing a new element. This may take a minute.
            </p>
          </div>
        </div>
      ) : null}
      <div className="collection-gallery__head">
        <h3 className="collection-gallery__title icon-label">
          <TypeGlyph type="Collection" size={18} />
          <span>Collections</span>
        </h3>
        <p className="collection-gallery__lede muted">
          Sets that include this element. Drag a tree node here to add. Right-click a collection for morph targets.
        </p>
        <button type="button" className="collection-gallery__create icon-label" onClick={() => void onCreate()}>
          <IconPlus size={16} />
          <span>Create</span>
        </button>
      </div>
      {err ? <p className="error">{err}</p> : null}
      {loading ? <p className="muted">Loading collections…</p> : null}
      <div className="collection-gallery__strip">
        {rows.map((c) => (
          <div
            key={c.id}
            className="collection-gallery__card"
            onDragOver={onDragOver}
            onDrop={(e) => void onDropToCollection(c.id, e)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ x: e.clientX, y: e.clientY, collectionId: c.id })
            }}
          >
            <Link to={`/elements/${c.id}`} className="collection-gallery__card-link icon-label">
              <TypeGlyph type="Collection" size={14} />
              <span className="collection-gallery__card-title">{c.title || 'Untitled collection'}</span>
            </Link>
            <button
              type="button"
              className="collection-gallery__card-remove"
              title="Delete collection"
              aria-label="Delete collection"
              onClick={(e) => void onDeleteCollection(c.id, e)}
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
        {rows.length === 0 && !loading ? <p className="muted collection-gallery__empty">No collections yet.</p> : null}
      </div>
      {menu ? (
        <ul
          className="collection-gallery__ctx tag-tree__ctx"
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 300 }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <li>
            <Link
              role="menuitem"
              className="collection-gallery__ctx-link"
              to={`/morph/${encodeURIComponent(menu.collectionId)}`}
              onClick={() => setMenu(null)}
            >
              <IconZap size={14} />
              Morph preview
            </Link>
          </li>
          <li>
            <Link
              role="menuitem"
              className="collection-gallery__ctx-link"
              to={`/graph?root=${encodeURIComponent(menu.collectionId)}&analyze=1`}
              onClick={() => setMenu(null)}
            >
              <IconNetwork size={14} />
              Open graph
            </Link>
          </li>
          <li className="collection-gallery__ctx-sep" role="separator" />
          {MORPH_TARGETS.map((t) => (
            <li key={t}>
              <button
                type="button"
                role="menuitem"
                onClick={() => void runMorph(menu.collectionId, t)}
              >
                To {t}…
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
