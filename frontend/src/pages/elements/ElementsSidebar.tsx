import { useMemo, useState } from 'react'
import { TagTreeFromRoot } from '../../components/TagTreeView'
import { IconChevronDown, IconChevronRight, IconLayers, IconListTree, IconRefreshCw } from '../../components/ui/icons'
import { TypeGlyph } from '../../components/ui/icons'
import { useElementsData } from '../../context/ElementsDataContext'
import { ELEMENT_TYPE_OPTIONS } from '../../constants/elementTypes'
import { buildTagTrieForElements, filterElementsByCategory } from '../../utils/tagTree'

function countByCategory(elements: ReturnType<typeof useElementsData>['elements'], type: 'all' | string) {
  if (type === 'all') return elements.length
  return elements.filter((e) => e.type_hint === type).length
}

export function ElementsSidebar() {
  const { elements, loading, error, refresh } = useElementsData()
  const elementsById = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements])

  const allTrie = useMemo(() => buildTagTrieForElements(elements), [elements])

  const triesByType = useMemo(() => {
    const m = new Map<string, ReturnType<typeof buildTagTrieForElements>>()
    for (const opt of ELEMENT_TYPE_OPTIONS) {
      const filtered = filterElementsByCategory(elements, opt.value)
      m.set(opt.value, buildTagTrieForElements(filtered))
    }
    return m
  }, [elements])

  const [openAll, setOpenAll] = useState(true)
  const [openType, setOpenType] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ELEMENT_TYPE_OPTIONS.map((o) => [o.value, true])),
  )

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
        <ul className="nav-type-tree">
          <li className="nav-type-tree__node">
            <button
              type="button"
              className="nav-type-tree__head icon-label"
              onClick={() => setOpenAll((o) => !o)}
              aria-expanded={openAll}
            >
              {openAll ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <IconLayers size={16} />
              <span className="nav-type-tree__label">All</span>
              <span className="elements-sidebar__type-count">{countByCategory(elements, 'all')}</span>
            </button>
            {openAll ? (
              <div className="nav-type-tree__body">
                {elements.length === 0 ? (
                  <p className="muted elements-sidebar__empty">No elements yet.</p>
                ) : (
                  <TagTreeFromRoot root={allTrie} elementsById={elementsById} />
                )}
              </div>
            ) : null}
          </li>

          {ELEMENT_TYPE_OPTIONS.map((opt) => {
            const n = countByCategory(elements, opt.value)
            const trie = triesByType.get(opt.value)!
            const open = openType[opt.value] ?? true
            return (
              <li key={opt.value} className="nav-type-tree__node">
                <button
                  type="button"
                  className="nav-type-tree__head icon-label"
                  onClick={() => setOpenType((m) => ({ ...m, [opt.value]: !open }))}
                  aria-expanded={open}
                >
                  {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                  <TypeGlyph type={opt.value} size={16} />
                  <span className="nav-type-tree__label">{opt.label}</span>
                  <span className="elements-sidebar__type-count">{n}</span>
                </button>
                {open ? (
                  <div className="nav-type-tree__body">
                    {n === 0 ? (
                      <p className="muted elements-sidebar__empty">No elements of this type.</p>
                    ) : (
                      <TagTreeFromRoot root={trie} elementsById={elementsById} />
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </aside>
  )
}
