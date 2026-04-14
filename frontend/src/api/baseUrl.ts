import { loadSettings } from '../settings/settingsStorage'

/** Backend REST API base (elements, graph, morph, …). Empty setting = `/api`. */
export function getApiBaseUrl(): string {
  const u = loadSettings().apiBaseUrl.trim()
  if (!u) return '/api'
  return u.replace(/\/$/, '')
}
