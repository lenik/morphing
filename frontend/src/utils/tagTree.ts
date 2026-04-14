import type { Element } from '../api/types'

/** Sentinel path segment for elements with no tags */
export const TAG_UNTAGGED = '(untagged)'

/**
 * Synthetic parent: when every tag on an element is non-root under the base rule,
 * the path starts with this node so co-occurring-only tags never sit directly under the root.
 */
export const SYNTHETIC_CO = '__SYNTHETIC_CO_OCCUR__'

function tagSet(el: Element): Set<string> {
  return new Set((el.tags || []).map((t) => (t || '').trim()).filter(Boolean))
}

/** Per-tag frequency: how many elements include this tag (at most once per element). */
export function computeTagFrequency(elements: Element[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const el of elements) {
    const seen = new Set<string>()
    for (const t of el.tags || []) {
      const x = (t || '').trim()
      if (!x || seen.has(x)) continue
      seen.add(x)
      m.set(x, (m.get(x) ?? 0) + 1)
    }
  }
  return m
}

function impliesTag(a: string, b: string, elements: Element[]): boolean {
  for (const el of elements) {
    const ts = tagSet(el)
    if (ts.has(a) && !ts.has(b)) return false
  }
  return true
}

class UnionFind {
  private parent = new Map<string, string>()

  constructor(keys: string[]) {
    for (const k of keys) this.parent.set(k, k)
  }

  find(x: string): string {
    const p = this.parent.get(x)!
    if (p !== x) this.parent.set(x, this.find(p))
    return this.parent.get(x)!
  }

  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }

  groups(): Map<string, string[]> {
    const m = new Map<string, string[]>()
    for (const k of this.parent.keys()) {
      const r = this.find(k)
      if (!m.has(r)) m.set(r, [])
      m.get(r)!.push(k)
    }
    return m
  }
}

/**
 * Tags allowed near the root segment of a path:
 * 1. **Singleton**: some element has exactly `{t}`.
 * 2. **Universal**: `t` appears on every element in the current scope (frequency === n).
 * 3. **Cohesive cluster (mutual implication)**: tags `a` and `b` are equivalent if every element
 *    that contains `a` also contains `b` and vice versa. For any equivalence class with size ≥ 2
 *    where no member appears alone on an element, the highest-frequency tag in that class (then
 *    name) is treated as root-eligible. This covers the case where two tags only ever appear
 *    together and neither has a singleton element.
 */
export function computeCanBeRoot(elements: Element[]): Set<string> {
  const s = new Set<string>()
  const n = elements.length
  const freq = computeTagFrequency(elements)
  const allTags = [...freq.keys()]

  for (const el of elements) {
    const tags = [...tagSet(el)]
    if (tags.length === 1) s.add(tags[0])
  }

  for (const t of allTags) {
    if ((freq.get(t) ?? 0) === n && n > 0) s.add(t)
  }

  if (allTags.length >= 2) {
    const uf = new UnionFind(allTags)
    for (let i = 0; i < allTags.length; i++) {
      for (let j = i + 1; j < allTags.length; j++) {
        const a = allTags[i]
        const b = allTags[j]
        if (impliesTag(a, b, elements) && impliesTag(b, a, elements)) {
          uf.union(a, b)
        }
      }
    }
    for (const group of uf.groups().values()) {
      if (group.length < 2) continue
      let hasSingletonMember = false
      for (const t of group) {
        for (const el of elements) {
          const ts = [...tagSet(el)]
          if (ts.length === 1 && ts[0] === t) {
            hasSingletonMember = true
            break
          }
        }
        if (hasSingletonMember) break
      }
      if (hasSingletonMember) continue
      const best = [...group].sort((a, b) => {
        const df = (freq.get(b) ?? 0) - (freq.get(a) ?? 0)
        if (df !== 0) return df
        return a.localeCompare(b)
      })[0]
      s.add(best)
    }
  }

  return s
}

function sortByFreqThenName(freq: Map<string, number>): (a: string, b: string) => number {
  return (a, b) => {
    const df = (freq.get(b) ?? 0) - (freq.get(a) ?? 0)
    if (df !== 0) return df
    return a.localeCompare(b)
  }
}

/**
 * Build one tag path per element (see `docs/tag-tree.md`).
 */
export function buildPathForElement(
  el: Element,
  freq: Map<string, number>,
  canBeRoot: Set<string>,
): string[] {
  const raw = [...tagSet(el)]
  if (raw.length === 0) return [TAG_UNTAGGED]

  const cmp = sortByFreqThenName(freq)
  const rootable = raw.filter((t) => canBeRoot.has(t)).sort(cmp)
  const nonRootable = raw.filter((t) => !canBeRoot.has(t)).sort(cmp)

  if (rootable.length > 0) {
    return [...rootable, ...nonRootable]
  }
  return [SYNTHETIC_CO, ...raw.sort(cmp)]
}

export type TrieTagNode = {
  kind: 'tag'
  /** Same tag string may appear many times; `id` distinguishes instances. */
  id: string
  tag: string
  freq: number
  children: TrieChild[]
}

export type TrieElementLeaf = {
  kind: 'element'
  id: string
  title: string
}

export type TrieChild = TrieTagNode | TrieElementLeaf

let nextNodeId = 1

function nextId(prefix: string) {
  return `${prefix}-${nextNodeId++}`
}

/** Insert one path without merging duplicate tag nodes. */
function insertPathNoMerge(
  root: TrieTagNode,
  pathTags: string[],
  el: Element,
  freq: Map<string, number>,
) {
  let node = root
  for (const t of pathTags) {
    const child: TrieTagNode = {
      kind: 'tag',
      id: nextId('tag'),
      tag: t,
      freq: t === SYNTHETIC_CO ? 0 : (freq.get(t) ?? 0),
      children: [],
    }
    node.children.push(child)
    node = child
  }
  const title = el.title?.trim() || '(untitled)'
  if (!node.children.some((c) => c.kind === 'element' && c.id === el.id)) {
    node.children.push({ kind: 'element', id: el.id, title })
  }
}

export function sortTrieChildren(children: TrieChild[], freq: Map<string, number>): TrieChild[] {
  const tags = children.filter((c): c is TrieTagNode => c.kind === 'tag')
  const els = children.filter((c): c is TrieElementLeaf => c.kind === 'element')
  tags.sort((a, b) => {
    if (a.tag === SYNTHETIC_CO && b.tag !== SYNTHETIC_CO) return -1
    if (b.tag === SYNTHETIC_CO && a.tag !== SYNTHETIC_CO) return 1
    const df = (freq.get(b.tag) ?? b.freq) - (freq.get(a.tag) ?? a.freq)
    if (df !== 0) return df
    return a.tag.localeCompare(b.tag)
  })
  els.sort((a, b) => a.title.localeCompare(b.title))
  return [...tags, ...els]
}

function sortTrieRecursive(node: TrieTagNode, freq: Map<string, number>) {
  node.children = sortTrieChildren(node.children, freq)
  for (const c of node.children) {
    if (c.kind === 'tag') sortTrieRecursive(c, freq)
  }
}

/**
 * Build the tag trie for a filtered element list (no merging of identical tag strings).
 */
export function buildTagTrieForElements(elements: Element[]): TrieTagNode {
  nextNodeId = 1
  const freq = computeTagFrequency(elements)
  const canBeRoot = computeCanBeRoot(elements)
  const root: TrieTagNode = { kind: 'tag', tag: '', id: 'root', freq: 0, children: [] }

  for (const el of elements) {
    const path = buildPathForElement(el, freq, canBeRoot)
    insertPathNoMerge(root, path, el, freq)
  }

  sortTrieRecursive(root, freq)
  return root
}

export function filterElementsByCategory(elements: Element[], category: string | 'all'): Element[] {
  if (category === 'all') return elements
  return elements.filter((e) => e.type_hint === category)
}
