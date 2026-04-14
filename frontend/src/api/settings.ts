import { getApiBaseUrl } from './baseUrl'
import type { AppSettings } from '../settings/settingsStorage'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const res = await fetch(`${getApiBaseUrl()}/settings/app`)
  return json<AppSettings>(res)
}

export async function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  const res = await fetch(`${getApiBaseUrl()}/settings/app`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return json<AppSettings>(res)
}

export type AppSettingsHealthCheckResult = {
  ok: boolean
  provider_status?: number | null
  model: string
  message: string
}

export async function testAppSettingsConnection(settings: AppSettings): Promise<AppSettingsHealthCheckResult> {
  const res = await fetch(`${getApiBaseUrl()}/settings/app/health-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return json<AppSettingsHealthCheckResult>(res)
}
