export type Element = {
  id: string
  title: string
  content: string
  type_hint: string
  tags: string[]
  metadata: Record<string, unknown>
  author: string
  version: number
  created_at: string
  updated_at: string
}

export type Comment = {
  id: string
  element_id: string
  author: string
  body: string
  created_at: string
}

export type Vote = {
  id: string
  element_id: string
  voter_id: string
  value: number
  created_at: string
  updated_at: string
}

export type Relation = {
  id: string
  parent_id: string
  child_id: string
  relation_type: string
  created_at: string
}
