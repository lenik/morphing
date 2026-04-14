/**
 * Per-type slot definitions (stored in Element.metadata.slots as strings).
 * Merges with other metadata keys on save.
 */

import { ELEMENT_TYPE_VIEWS } from './elementSlotsByType'
import type { TypeViewConfig } from './elementSlotsTypes'

export type { SlotFieldDef, TypeViewConfig } from './elementSlotsTypes'
export { ELEMENT_TYPE_VIEWS }

export function getViewConfig(typeHint: string): TypeViewConfig {
  return (
    ELEMENT_TYPE_VIEWS[typeHint] ?? {
      contentLabel: 'Body',
      slots: [],
    }
  )
}

export function getSlotsMap(metadata: Record<string, unknown> | undefined): Record<string, string> {
  const raw = metadata?.slots
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = v == null ? '' : String(v)
  }
  return out
}

export function defaultSlotsForType(typeHint: string): Record<string, string> {
  const cfg = getViewConfig(typeHint)
  const o: Record<string, string> = {}
  for (const f of cfg.slots) o[f.key] = ''
  return o
}

export function mergeSlotsForType(typeHint: string, existing: Record<string, string>): Record<string, string> {
  return { ...defaultSlotsForType(typeHint), ...existing }
}
