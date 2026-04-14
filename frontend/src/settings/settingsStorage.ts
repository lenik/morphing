export type AppSettings = {
  /** Empty = use same-origin `/api` (Vite proxy in dev). Example: `http://127.0.0.1:8000/api` */
  apiBaseUrl: string
  /** OpenAI-compatible chat/completions base, e.g. `https://api.openai.com/v1` */
  openaiApiBaseUrl: string
  openaiApiKey: string
  openaiOrganizationId: string
  openaiDefaultModel: string
  aiCompletionAcceptConfidence: number
  showCompleteRequestMessageToLlm: boolean
  /** Used when wiring fetch with AbortSignal (future); stored for UI consistency */
  requestTimeoutSec: number
  useBrowserNotifications: boolean
  /** Prefilled author on new element form */
  defaultAuthorName: string
  /** UI language tag for future i18n */
  locale: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  apiBaseUrl: '',
  openaiApiBaseUrl: 'https://api.openai.com/v1',
  openaiApiKey: '',
  openaiOrganizationId: '',
  openaiDefaultModel: 'gpt-4o-mini',
  aiCompletionAcceptConfidence: 0.6,
  showCompleteRequestMessageToLlm: false,
  requestTimeoutSec: 120,
  useBrowserNotifications: true,
  defaultAuthorName: '',
  locale: 'en',
}

let runtimeSettings: AppSettings = { ...DEFAULT_APP_SETTINGS }

export function loadSettings(): AppSettings {
  return { ...runtimeSettings }
}

export function persistSettings(next: AppSettings): void {
  runtimeSettings = { ...DEFAULT_APP_SETTINGS, ...next }
}

export function saveSettingsPatch(partial: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...partial }
  persistSettings(next)
  return next
}

export function resetStoredSettings(): AppSettings {
  runtimeSettings = { ...DEFAULT_APP_SETTINGS }
  return { ...runtimeSettings }
}

export function getOpenAiConfig() {
  const s = loadSettings()
  const base = s.openaiApiBaseUrl.trim() || DEFAULT_APP_SETTINGS.openaiApiBaseUrl
  return {
    baseUrl: base.replace(/\/$/, ''),
    apiKey: s.openaiApiKey,
    organizationId: s.openaiOrganizationId.trim(),
    defaultModel: s.openaiDefaultModel.trim() || DEFAULT_APP_SETTINGS.openaiDefaultModel,
    timeoutSec: Math.max(5, s.requestTimeoutSec || DEFAULT_APP_SETTINGS.requestTimeoutSec),
  }
}
