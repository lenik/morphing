export type SlotFieldDef = {
  key: string
  label: string
  multiline?: boolean
  placeholder?: string
  /** UI section heading (structured slots form). */
  group?: string
}

export type TypeViewConfig = {
  contentLabel: string
  contentPlaceholder?: string
  slots: SlotFieldDef[]
}
