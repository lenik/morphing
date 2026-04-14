import type { Comment, Element, Relation, Vote } from './types'
import { getApiBaseUrl } from './baseUrl'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function fetchElements(params?: {
  type_hint?: string
  tag?: string
  skip?: number
  limit?: number
}): Promise<Element[]> {
  const q = new URLSearchParams()
  if (params?.type_hint) q.set('type_hint', params.type_hint)
  if (params?.tag) q.set('tag', params.tag)
  if (params?.skip != null) q.set('skip', String(params.skip))
  if (params?.limit != null) q.set('limit', String(params.limit))
  const url = `${getApiBaseUrl()}/elements${q.toString() ? `?${q}` : ''}`
  const res = await fetch(url)
  return json<Element[]>(res)
}

export async function fetchElement(id: string): Promise<Element> {
  const res = await fetch(`${getApiBaseUrl()}/elements/${id}`)
  return json<Element>(res)
}

export async function createElement(
  body: Partial<Pick<Element, 'title' | 'content' | 'type_hint' | 'tags' | 'metadata' | 'author'>>,
): Promise<Element> {
  const res = await fetch(`${getApiBaseUrl()}/elements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: body.title ?? '',
      content: body.content ?? '',
      type_hint: body.type_hint ?? 'Idea',
      tags: body.tags ?? [],
      metadata: body.metadata ?? {},
      author: body.author ?? '',
    }),
  })
  return json<Element>(res)
}

export async function patchElement(
  id: string,
  body: Partial<Pick<Element, 'title' | 'content' | 'type_hint' | 'tags' | 'metadata' | 'author'>>,
): Promise<Element> {
  const payload: Record<string, unknown> = {}
  if (body.title !== undefined) payload.title = body.title
  if (body.content !== undefined) payload.content = body.content
  if (body.type_hint !== undefined) payload.type_hint = body.type_hint
  if (body.tags !== undefined) payload.tags = body.tags
  if (body.metadata !== undefined) payload.metadata = body.metadata
  if (body.author !== undefined) payload.author = body.author
  const res = await fetch(`${getApiBaseUrl()}/elements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return json<Element>(res)
}

export async function uploadElementIcon(elementId: string, file: File): Promise<Element> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${getApiBaseUrl()}/elements/${elementId}/icon`, {
    method: 'POST',
    body: fd,
  })
  return json<Element>(res)
}

export async function fetchComments(elementId: string): Promise<Comment[]> {
  const res = await fetch(`${getApiBaseUrl()}/elements/${elementId}/comments`)
  return json<Comment[]>(res)
}

export async function addComment(elementId: string, author: string, body: string): Promise<Comment> {
  const res = await fetch(`${getApiBaseUrl()}/elements/${elementId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, body }),
  })
  return json<Comment>(res)
}

export async function fetchVotes(elementId: string): Promise<Vote[]> {
  const res = await fetch(`${getApiBaseUrl()}/elements/${elementId}/votes`)
  return json<Vote[]>(res)
}

export async function upsertVote(elementId: string, voterId: string, value: -1 | 0 | 1): Promise<Vote | null> {
  const res = await fetch(`${getApiBaseUrl()}/elements/${elementId}/votes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voter_id: voterId, value }),
  })
  if (res.status === 204) return null
  return json<Vote>(res)
}

export async function fetchRelationBundle(elementId: string): Promise<{
  upstream: Relation[]
  downstream: Relation[]
}> {
  const res = await fetch(`${getApiBaseUrl()}/relations/by-element/${elementId}`)
  return json(res)
}

export type Subgraph = {
  root_id: string
  depth: number
  direction: string
  nodes: { id: string; title: string; type_hint: string; version: number }[]
  edges: { id: string; parent_id: string; child_id: string; relation_type: string }[]
}

export async function loadSubgraph(
  elementId: string,
  depth = 3,
  direction: 'upstream' | 'downstream' | 'both' = 'both',
): Promise<Subgraph> {
  const q = new URLSearchParams({ depth: String(depth), direction })
  const res = await fetch(`${getApiBaseUrl()}/graph/elements/${encodeURIComponent(elementId)}/load?${q}`)
  return json<Subgraph>(res)
}

export type AiTrace = {
  kind?: string
  model?: string | null
  summary?: string
  key_prompt?: string
  assistant_excerpt?: string
  llm_request?: string
}

export async function completeSlots(body: {
  title: string
  type_hint: string
  content: string
  openai_api_key?: string
  openai_base_url?: string
  model?: string
  accept_confidence?: number
  allow_custom_facets?: boolean
  show_complete_request_to_llm?: boolean
}): Promise<{
  slots: Record<string, string>
  slot_confidences: Record<string, number>
  accepted_slots: Record<string, string>
  extra_slots: Record<string, string>
  extra_slot_confidences: Record<string, number>
  accepted_extra_slots: Record<string, string>
  accepted_title?: string | null
  accepted_body?: string | null
  applied_threshold: number
  ai_trace: AiTrace
}> {
  const res = await fetch(`${getApiBaseUrl()}/ai/complete-slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return json(res)
}

export async function completeSlotsStream(
  body: {
    title: string
    type_hint: string
    content: string
    openai_api_key?: string
    openai_base_url?: string
    model?: string
    accept_confidence?: number
    allow_custom_facets?: boolean
    show_complete_request_to_llm?: boolean
    locale?: string
  },
  handlers: {
    onDelta?: (text: string) => void
    onReasoning?: (text: string) => void
    onErrorEvent?: (message: string) => void
  } = {},
): Promise<{
  slots: Record<string, string>
  slot_confidences: Record<string, number>
  accepted_slots: Record<string, string>
  extra_slots: Record<string, string>
  extra_slot_confidences: Record<string, number>
  accepted_extra_slots: Record<string, string>
  accepted_title?: string | null
  accepted_body?: string | null
  applied_threshold: number
  ai_trace: AiTrace
}> {
  const res = await fetch(`${getApiBaseUrl()}/ai/complete-slots-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (!res.body) throw new Error('No stream body from server.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalPayload: any = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      let evt: any
      try {
        evt = JSON.parse(line)
      } catch {
        continue
      }
      if (evt.type === 'delta' && typeof evt.text === 'string') {
        handlers.onDelta?.(evt.text)
      } else if (evt.type === 'reasoning' && typeof evt.text === 'string') {
        handlers.onReasoning?.(evt.text)
      } else if (evt.type === 'error' && typeof evt.message === 'string') {
        handlers.onErrorEvent?.(evt.message)
      } else if (evt.type === 'final') {
        finalPayload = evt
      }
    }
  }
  if (!finalPayload) throw new Error('Stream finished without final payload.')
  return {
    slots: finalPayload.slots || {},
    slot_confidences: finalPayload.slot_confidences || {},
    accepted_slots: finalPayload.accepted_slots || {},
    extra_slots: finalPayload.extra_slots || {},
    extra_slot_confidences: finalPayload.extra_slot_confidences || {},
    accepted_extra_slots: finalPayload.accepted_extra_slots || {},
    accepted_title: finalPayload.accepted_title ?? null,
    accepted_body: finalPayload.accepted_body ?? null,
    applied_threshold: Number(finalPayload.applied_threshold ?? 0.6),
    ai_trace: finalPayload.ai_trace || {},
  }
}

export async function fetchCollectionsContaining(elementId: string): Promise<Element[]> {
  const res = await fetch(`${getApiBaseUrl()}/collections/containing/${encodeURIComponent(elementId)}`)
  return json<Element[]>(res)
}

export async function createCollection(body: {
  title: string
  member_ids: string[]
  author?: string
}): Promise<Element> {
  const res = await fetch(`${getApiBaseUrl()}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return json<Element>(res)
}

export async function patchCollectionMembers(
  collectionId: string,
  body: { add?: string[]; remove?: string[] },
): Promise<Element> {
  const res = await fetch(`${getApiBaseUrl()}/collections/${encodeURIComponent(collectionId)}/members`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return json<Element>(res)
}

export async function morphCollectionToType(
  collectionId: string,
  body: {
    target_type: string
    openai_api_key?: string
    openai_base_url?: string
    model?: string
    show_complete_request_to_llm?: boolean
  },
): Promise<{ element: Element; ai_trace: AiTrace }> {
  const res = await fetch(`${getApiBaseUrl()}/collections/${encodeURIComponent(collectionId)}/morph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return json(res)
}

export async function deleteElement(elementId: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/elements/${encodeURIComponent(elementId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
}
