import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronDown, IconChevronRight, IconListTree, IconRefreshCw } from '../../components/ui/icons'
import { TypeGlyph } from '../../components/ui/icons'
import { useElementsData } from '../../context/ElementsDataContext'
import { ELEMENT_TYPE_OPTIONS } from '../../constants/elementTypes'
import { buildTagTrieForElements, filterElementsByCategory } from '../../utils/tagTree'
import type { TrieTagNode } from '../../utils/tagTree'

function countByCategory(elements: ReturnType<typeof useElementsData>['elements'], type: string) {
  return elements.filter((e) => e.type_hint === type).length
}

export function ElementsSidebar() {
  const { elements, loading, error, refresh } = useElementsData()
  const triesByType = useMemo(() => {
    const m = new Map<string, TrieTagNode>()
    for (const opt of ELEMENT_TYPE_OPTIONS) {
      const filtered = filterElementsByCategory(elements, opt.value)
      m.set(opt.value, buildTagTrieForElements(filtered))
    }
    return m
  }, [elements])
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ELEMENT_TYPE_OPTIONS.map((o) => [`type:${o.value}`, true])),
  )
  const [selectedType, setSelectedType] = useState<string>(ELEMENT_TYPE_OPTIONS[0].value)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const listedElements = useMemo(() => {
    const typed = elements.filter((e) => e.type_hint === selectedType)
    if (!selectedTag) return typed
    return typed.filter((e) => (e.tags || []).includes(selectedTag))
  }, [elements, selectedType, selectedTag])

  const toggleNode = (id: string) => setOpenNodes((m) => ({ ...m, [id]: !(m[id] ?? true) }))

  return (
    <aside className="elements-sidebar">
      <div className="elements-sidebar__head">
        <h3 className="elements-sidebar__heading icon-label">
          <IconListTree size={17} />
          <span>Navigator</span>
        </h3>
        <button
          type="button"
          className="elements-sidebar__refresh icon-label"
          onClick={() => void refresh()}
          title="Refresh list"
        >
          <IconRefreshCw size={16} />
          <span className="sr-only">Refresh</span>
        </button>
      </div>
      <p className="elements-sidebar__hint muted">
        Tree: each type is the root for its tag trie. Rules: <code>docs/tag-tree.md</code>.
      </p>

      {loading ? (
        <p className="muted icon-label">
          <IconRefreshCw size={14} />
          <span>Loading…</span>
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <div className="elements-sidebar__split">
          <div className="elements-sidebar__tree-pane">
            <ul className="nav-type-tree nav-type-tree--super">
              {ELEMENT_TYPE_OPTIONS.map((opt) => {
                const n = countByCategory(elements, opt.value)
                const trie = triesByType.get(opt.value)!
                const typeNodeId = `type:${opt.value}`
                const typeOpen = openNodes[typeNodeId] ?? true
                return (
                  <li key={opt.value} className="nav-type-tree__node">
                    <div className="nav-type-tree__row">
                      <button
                        type="button"
                        className="elements-sidebar__tag-caret elements-sidebar__tag-caret--btn"
                        aria-label={typeOpen ? `Collapse ${opt.label}` : `Expand ${opt.label}`}
                        onClick={() => toggleNode(typeNodeId)}
                      >
                        {typeOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                      </button>
                      <button
                        type="button"
                        className={`nav-type-tree__head nav-type-tree__head--flat icon-label ${selectedType === opt.value && !selectedTag ? 'nav-type-tree__head--active' : ''}`}
                        onClick={() => {
                          setSelectedType(opt.value)
                          setSelectedTag(null)
                        }}
                      >
                        <TypeGlyph type={opt.value} size={16} />
                        <span className="nav-type-tree__label">{opt.label}</span>
                        <span className="elements-sidebar__type-count">{n}</span>
                      </button>
                    </div>
                    {typeOpen ? (
                      <TagOnlyTree
                        nodes={trie.children.filter((c): c is TrieTagNode => c.kind === 'tag')}
                        selectedTag={selectedTag}
                        onSelectTag={(tag) => {
                          setSelectedType(opt.value)
                          setSelectedTag(tag)
                        }}
                        openNodes={openNodes}
                        onToggleNode={toggleNode}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="elements-sidebar__list-pane">
            <div className="elements-sidebar__list-head">
              <strong>{selectedType}</strong>
              <span className="elements-sidebar__list-filter">
                {selectedTag ? `tag: ${selectedTag}` : 'all tags'}
              </span>
              <span className="elements-sidebar__type-count">{listedElements.length}</span>
            </div>
            <ul className="elements-sidebar__element-list">
              {listedElements.map((el) => (
                <li key={el.id}>
                  <Link to={`/elements/${el.id}`} className="elements-sidebar__element-link" title={el.title}>
                    {el.title || '(untitled)'}
                  </Link>
                </li>
              ))}
              {listedElements.length === 0 ? <li className="muted elements-sidebar__empty">No elements in current filter.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function TagOnlyTree({
  nodes,
  selectedTag,
  onSelectTag,
  openNodes,
  onToggleNode,
  depth = 0,
}: {
  nodes: TrieTagNode[]
  selectedTag: string | null
  onSelectTag: (tag: string) => void
  openNodes: Record<string, boolean>
  onToggleNode: (id: string) => void
  depth?: number
}) {
  if (nodes.length === 0) return null
  return (
    <ul className="elements-sidebar__tag-tree" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {nodes.map((node) => {
        const childTags = node.children.filter((c): c is TrieTagNode => c.kind === 'tag')
        const open = openNodes[node.id] ?? true
        return (
          <li key={node.id} className="elements-sidebar__tag-node">
            <button
              type="button"
              className={`elements-sidebar__tag-btn ${selectedTag === node.tag ? 'is-active' : ''}`}
              onClick={() => onSelectTag(node.tag)}
            >
              {childTags.length > 0 ? (
                <span
                  className="elements-sidebar__tag-caret"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleNode(node.id)
                  }}
                >
                  {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                </span>
              ) : (
                <span className="elements-sidebar__tag-caret" />
              )}
              <span>{node.tag}</span>
            </button>
            {open ? (
              <TagOnlyTree
                nodes={childTags}
                selectedTag={selectedTag}
                onSelectTag={onSelectTag}
                openNodes={openNodes}
                onToggleNode={onToggleNode}
                depth={depth + 1}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
