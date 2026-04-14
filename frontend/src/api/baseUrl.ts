import { loadSettings } from '../settings/settingsStorage'

/** Backend REST API base (elements, graph, morph, …). Empty setting = `/api`. */
export function getApiBaseUrl(): string {
  const u = loadSettings().apiBaseUrl.trim()
  if (!u) return '/api'
  const trimmed = u.replace(/\/+$/, '')
  // If user provides site origin/root (e.g. https://morphing.bodz.net),
  // normalize to API prefix automatically.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const path = url.pathname.replace(/\/+$/, '')
      if (!path || path === '') {
        url.pathname = '/api'
        return url.toString().replace(/\/+$/, '')
      }
      if (!path.endsWith('/api')) {
        url.pathname = `${path}/api`
        return url.toString().replace(/\/+$/, '')
      }
      return url.toString().replace(/\/+$/, '')
    } catch {
      return trimmed
    }
  }
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}
