import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import type { Element } from '../api/types'
import type { TrieChild, TrieTagNode } from '../utils/tagTree'
import { SYNTHETIC_CO, TAG_UNTAGGED } from '../utils/tagTree'
import { TAG_DISPLAY } from './tagTreeConstants'
import { IconChevronDown, IconChevronRight, IconFileText, IconLayers, IconNetwork, IconTag, IconZap } from './ui/icons'

export const ELEMENT_DRAG_MIME = 'application/x-morphing-element-id'

type Props = {
  nodes: TrieChild[]
  depth?: number
  elementsById?: Map<string, Element>
}

export function TagTreeView({ nodes, depth = 0, elementsById }: Props) {
  if (nodes.length === 0) return null
  return (
    <ul className="tag-tree" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {nodes.map((node) => (
        <TagTreeItem
          key={node.kind === 'tag' ? node.id : `el-${node.id}`}
          node={node}
          depth={depth}
          elementsById={elementsById}
        />
      ))}
    </ul>
  )
}

function TagTreeItem({
  node,
  depth,
  elementsById,
}: {
  node: TrieChild
  depth: number
  elementsById?: Map<string, Element>
}) {
  const navigate = useNavigate()
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu])

  if (node.kind === 'element') {
    const md = elementsById?.get(node.id)?.metadata as Record<string, unknown> | undefined
    const thumb = md?.icon_thumb_url
    return (
      <li className="tag-tree__leaf">
        <NavLink
          to={`/elements/${node.id}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(ELEMENT_DRAG_MIME, node.id)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          className={({ isActive }) =>
            ['tag-tree__el', isActive ? 'tag-tree__el--active' : '', thumb ? 'tag-tree__el--thumb' : '']
              .filter(Boolean)
              .join(' ')
          }
          onContextMenu={(e) => {
            e.preventDefault()
            setCtxMenu({ x: e.clientX, y: e.clientY })
          }}
        >
          {typeof thumb === 'string' ? (
            <img src={thumb} alt="" className="tag-tree__thumb" width={20} height={20} />
          ) : (
            <IconFileText size={14} className="tag-tree__glyph" />
          )}
          <span className="tag-tree__el-title">{node.title}</span>
        </NavLink>
        {ctxMenu ? (
          <ul
            className="tag-tree__ctx"
            style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 200 }}
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/graph?root=${encodeURIComponent(node.id)}&analyze=1`)
                  setCtxMenu(null)
                }}
              >
                <IconNetwork size={14} />
                Open graph analysis
              </button>
            </li>
          </ul>
        ) : null}
      </li>
    )
  }
  const label = node.tag === '' ? null : formatTagLabel(node.tag)
  const [open, setOpen] = useState(true)
  return (
    <li className="tag-tree__branch">
      {label ? (
        <button
          type="button"
          className="tag-tree__tag icon-label"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
          <TagGlyph tag={node.tag} />
          <span>{label}</span>
        </button>
      ) : null}
      {open ? <TagTreeView nodes={node.children} depth={depth + 1} elementsById={elementsById} /> : null}
    </li>
  )
}

function TagGlyph({ tag }: { tag: string }) {
  if (tag === TAG_UNTAGGED) return <IconLayers size={13} />
  if (tag === SYNTHETIC_CO) return <IconZap size={13} />
  return <IconTag size={13} />
}

function formatTagLabel(tag: string): string {
  if (tag === TAG_UNTAGGED) return TAG_DISPLAY[TAG_UNTAGGED] ?? tag
  if (tag === SYNTHETIC_CO) return TAG_DISPLAY[SYNTHETIC_CO] ?? tag
  return tag
}

export function TagTreeFromRoot({
  root,
  elementsById,
}: {
  root: TrieTagNode
  elementsById?: Map<string, Element>
}) {
  return <TagTreeView nodes={root.children} depth={0} elementsById={elementsById} />
}
