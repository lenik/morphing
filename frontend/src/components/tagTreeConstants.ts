import { SYNTHETIC_CO, TAG_UNTAGGED } from '../utils/tagTree'

/** Display labels for internal sentinel tags (see `docs/tag-tree.md`). */
export const TAG_DISPLAY: Record<string, string> = {
  [TAG_UNTAGGED]: 'Untagged',
  [SYNTHETIC_CO]: 'Co-only tags',
}
