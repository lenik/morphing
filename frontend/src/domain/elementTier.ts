/**
 * Narrative pipeline tier (lower = earlier / more upstream in the chain).
 * Upstream references on an element may only point to elements with strictly lower tier.
 */
export const ELEMENT_TYPE_TIER: Record<string, number> = {
  Idea: 0,
  Character: 1,
  Scene: 2,
  Story: 3,
  Script: 4,
  Storyboard: 5,
  Shot: 6,
  Collection: 0,
}

export function getElementTier(typeHint: string): number {
  return ELEMENT_TYPE_TIER[typeHint] ?? 99
}

/** True if `candidateType` may appear as an upstream dependency of `currentType`. */
export function canBeUpstreamOf(candidateType: string, currentType: string): boolean {
  return getElementTier(candidateType) < getElementTier(currentType)
}
