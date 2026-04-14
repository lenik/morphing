import type { ComponentType } from 'react'
import type { SlotFieldDef } from '../domain/elementSlotsTypes'
import {
  IconAlignLeft,
  IconAlertTriangle,
  IconBookOpen,
  IconCamera,
  IconClapperboard,
  IconDatabase,
  IconFileText,
  IconGitBranch,
  IconHistory,
  IconLayers,
  IconLightbulb,
  IconListTree,
  IconMapPin,
  IconMessageSquare,
  IconTag,
  IconType,
  IconUser,
  IconZap,
} from './ui/icons'

const SZ = 13

type IconCmp = ComponentType<{ size?: number; className?: string }>

const GROUP_ICONS: Record<string, IconCmp> = {
  Identity: IconUser,
  Framing: IconLightbulb,
  Lifecycle: IconHistory,
  Quality: IconZap,
  References: IconBookOpen,
  Pitch: IconLightbulb,
  Appearance: IconUser,
  Voice: IconMessageSquare,
  Psychology: IconUser,
  Social: IconUser,
  Backstory: IconBookOpen,
  'Narrative arc': IconGitBranch,
  Production: IconCamera,
  Header: IconAlignLeft,
  Space: IconMapPin,
  Time: IconHistory,
  Atmosphere: IconZap,
  Narration: IconType,
  Structure: IconListTree,
  Staging: IconClapperboard,
  Theme: IconBookOpen,
  Conflict: IconAlertTriangle,
  Threads: IconGitBranch,
  World: IconMapPin,
  Market: IconUser,
  Process: IconHistory,
  Format: IconFileText,
  Style: IconAlignLeft,
  Audio: IconMessageSquare,
  Revision: IconHistory,
  Compliance: IconAlertTriangle,
  Look: IconCamera,
  Notes: IconAlignLeft,
  Camera: IconCamera,
  Lighting: IconZap,
  Art: IconClapperboard,
  VFX: IconZap,
  Post: IconClapperboard,
  Order: IconListTree,
  Fields: IconLayers,
  Collection: IconLayers,
}

export function SlotGroupIcon({ title }: { title: string }) {
  const Cmp = GROUP_ICONS[title] ?? IconLayers
  return <Cmp size={SZ} className="element-slots__glyph" />
}

export function SlotFieldIcon({ def }: { def: SlotFieldDef }) {
  const Cmp = fieldIconFor(def)
  return <Cmp size={SZ} className="element-slots__glyph" />
}

function fieldIconFor(def: SlotFieldDef): IconCmp {
  const k = def.key.toLowerCase()
  const label = def.label.toLowerCase()
  const blob = `${k} ${label}`

  if (/\b(voice|dialogue|music|sfx|sound|audio)\b/.test(blob)) return IconMessageSquare
  if (/\b(camera|lens|shot|framing|focus)\b/.test(blob)) return IconCamera
  if (/\b(light|color|weather|mood|atmosphere|palette)\b/.test(blob)) return IconZap
  if (/\b(time|duration|day|clock|schedule)\b/.test(blob)) return IconHistory
  if (/\b(location|geo|scene|space|map|place)\b/.test(blob)) return IconMapPin
  if (/\b(character|name|role|display|alias|pronoun|age|species)\b/.test(blob)) return IconUser
  if (/\b(backstory|arc|want|need|change|entrance|exit)\b/.test(blob)) return IconGitBranch
  if (/\b(conflict|stakes|antagon)\b/.test(blob)) return IconAlertTriangle
  if (/\b(theme|genre|tone|logline|title)\b/.test(blob)) return IconBookOpen
  if (/\b(status|priority|revision|review|process)\b/.test(blob)) return IconHistory
  if (/\b(tag|genre_tags|dependencies)\b/.test(blob)) return IconTag
  if (/\b(format|page|revision_color|aspect|resolution|frame)\b/.test(blob)) return IconFileText
  if (/\b(structure|act|midpoint|climax|beats|outline)\b/.test(blob)) return IconListTree
  if (/\b(world|rules|continuity|blocking|staging|prop)\b/.test(blob)) return IconLayers
  if (/\b(order|sort)\b/.test(blob)) return IconDatabase
  if (/\b(vfx|practical|costume|makeup|edit)\b/.test(blob)) return IconClapperboard
  if (def.multiline) return IconAlignLeft
  return IconAlignLeft
}
