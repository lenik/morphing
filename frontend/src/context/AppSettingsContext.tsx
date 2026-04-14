import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchAppSettings, saveAppSettings } from '../api/settings'
import type { AppSettings } from '../settings/settingsStorage'
import { loadSettings, persistSettings, resetStoredSettings } from '../settings/settingsStorage'

type Ctx = {
  settings: AppSettings
  /** Replace in memory + backend registry */
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  loading: boolean
}

const AppSettingsContext = createContext<Ctx | null>(null)

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchAppSettings()
      .then((remote) => {
        if (cancelled) return
        const local = loadSettings()
        const merged: AppSettings = {
          ...remote,
          // Migrate legacy local secrets/overrides if remote registry is still empty.
          openaiApiKey: remote.openaiApiKey || local.openaiApiKey || '',
          openaiApiBaseUrl: remote.openaiApiBaseUrl || local.openaiApiBaseUrl || '',
          openaiDefaultModel: remote.openaiDefaultModel || local.openaiDefaultModel || 'gpt-4o-mini',
          aiCompletionAcceptConfidence: Math.max(
            0.5,
            Math.min(1, remote.aiCompletionAcceptConfidence ?? local.aiCompletionAcceptConfidence ?? 0.6),
          ),
          apiBaseUrl: remote.apiBaseUrl || local.apiBaseUrl || '',
        }
        persistSettings(merged)
        setSettings(merged)
        // Best-effort backfill to server so next launch stays consistent.
        if (
          merged.openaiApiKey !== remote.openaiApiKey ||
          merged.openaiApiBaseUrl !== remote.openaiApiBaseUrl ||
          merged.openaiDefaultModel !== remote.openaiDefaultModel ||
          merged.apiBaseUrl !== remote.apiBaseUrl
        ) {
          void saveAppSettings(merged).catch(() => {})
        }
      })
      .catch(() => {
        // Keep local cache when backend settings endpoint is unavailable.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const next = { ...loadSettings(), ...partial }
    const saved = await saveAppSettings(next)
    persistSettings(saved)
    setSettings(saved)
    return saved
  }, [])

  const resetSettings = useCallback(async () => {
    const localDefault = resetStoredSettings()
    const saved = await saveAppSettings(localDefault)
    persistSettings(saved)
    setSettings(saved)
    return saved
  }, [])

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings, loading }),
    [settings, updateSettings, resetSettings, loading],
  )

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider')
  return ctx
}
