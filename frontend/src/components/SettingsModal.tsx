import { useEffect, useId, useState } from 'react'
import { testAppSettingsConnection } from '../api/settings'
import { useAppSettings } from '../context/AppSettingsContext'
import { IconSettings, IconX } from './ui/icons'

type Props = {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props) {
  const { settings, updateSettings, resetSettings } = useAppSettings()
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [healthResult, setHealthResult] = useState<{ ok: boolean; message: string; code?: number | null } | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      await updateSettings(draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!window.confirm('Reset all settings to defaults?')) return
    if (saving) return
    setSaving(true)
    try {
      const next = await resetSettings()
      setDraft(next)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    if (testing || saving) return
    if (!draft.openaiApiKey.trim()) {
      setHealthResult({ ok: false, message: 'API key is empty in current form state.' })
      return
    }
    setTesting(true)
    setHealthResult(null)
    try {
      const result = await testAppSettingsConnection(draft)
      setHealthResult({ ok: result.ok, message: result.message, code: result.provider_status ?? null })
    } catch (e) {
      setHealthResult({ ok: false, message: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="settings-modal" role="presentation">
      <button
        type="button"
        className="settings-modal__backdrop"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        className="settings-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="settings-modal__head">
          <h2 id={titleId} className="settings-modal__title icon-label">
            <IconSettings size={20} />
            <span>Settings</span>
          </h2>
          <button type="button" className="settings-modal__close icon-label" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </header>

        <div className="settings-modal__body">
          <p className="settings-modal__hint muted">
            Settings are loaded from and saved to the backend settings registry (database + server cache).
          </p>

          <fieldset className="settings-fieldset">
            <legend>Backend API</legend>
            <label className="settings-field">
              <span>REST API base URL</span>
              <input
                value={draft.apiBaseUrl}
                onChange={(e) => setDraft((d) => ({ ...d, apiBaseUrl: e.target.value }))}
                placeholder="Leave empty for same-origin /api"
                autoComplete="off"
              />
              <span className="settings-field__hint">
                Leave empty for same-origin <code>/api</code>. Example: <code>http://127.0.0.1:8000/api</code>
              </span>
            </label>
          </fieldset>

          <fieldset className="settings-fieldset">
            <legend>OpenAI-compatible</legend>
            <label className="settings-field">
              <span>API base URL</span>
              <input
                value={draft.openaiApiBaseUrl}
                onChange={(e) => setDraft((d) => ({ ...d, openaiApiBaseUrl: e.target.value }))}
                placeholder="https://api.openai.com/v1"
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>API key</span>
              <input
                type="password"
                value={draft.openaiApiKey}
                onChange={(e) => setDraft((d) => ({ ...d, openaiApiKey: e.target.value }))}
                placeholder="sk-…"
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>Organization ID (optional)</span>
              <input
                value={draft.openaiOrganizationId}
                onChange={(e) => setDraft((d) => ({ ...d, openaiOrganizationId: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>Default model</span>
              <input
                value={draft.openaiDefaultModel}
                onChange={(e) => setDraft((d) => ({ ...d, openaiDefaultModel: e.target.value }))}
                placeholder="gpt-4o-mini"
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>AI completion accept confidence (0.50 - 1.00)</span>
              <input
                inputMode="decimal"
                value={String(draft.aiCompletionAcceptConfidence)}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  setDraft((d) => ({
                    ...d,
                    aiCompletionAcceptConfidence: Number.isFinite(n) ? Math.max(0.5, Math.min(1, n)) : d.aiCompletionAcceptConfidence,
                  }))
                }}
              />
            </label>
            <label className="settings-field settings-field--check">
              <input
                type="checkbox"
                checked={draft.showCompleteRequestMessageToLlm}
                onChange={(e) => setDraft((d) => ({ ...d, showCompleteRequestMessageToLlm: e.target.checked }))}
              />
              <span>Show complete request message to LLM in AI Chat (debug)</span>
            </label>
            <label className="settings-field">
              <span>Request timeout (seconds)</span>
              <input
                inputMode="numeric"
                value={String(draft.requestTimeoutSec)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  setDraft((d) => ({ ...d, requestTimeoutSec: Number.isFinite(n) ? n : d.requestTimeoutSec }))
                }}
              />
            </label>
            <div className="settings-modal__health-row">
              <button
                type="button"
                className="button-secondary"
                onClick={() => void testConnection()}
                disabled={testing || saving}
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {healthResult ? (
                <span className={healthResult.ok ? 'muted' : 'error'}>
                  {healthResult.ok ? 'OK' : 'Failed'}
                  {healthResult.code ? ` (${healthResult.code})` : ''}: {healthResult.message}
                </span>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="settings-fieldset">
            <legend>Workspace</legend>
            <label className="settings-field">
              <span>Default author name</span>
              <input
                value={draft.defaultAuthorName}
                onChange={(e) => setDraft((d) => ({ ...d, defaultAuthorName: e.target.value }))}
                placeholder="Prefilled when creating new elements"
                autoComplete="name"
              />
            </label>
            <label className="settings-field">
              <span>Locale (future i18n)</span>
              <input
                value={draft.locale}
                onChange={(e) => setDraft((d) => ({ ...d, locale: e.target.value }))}
                placeholder="en"
                autoComplete="off"
              />
            </label>
            <label className="settings-field settings-field--check">
              <input
                type="checkbox"
                checked={draft.useBrowserNotifications}
                onChange={(e) => setDraft((d) => ({ ...d, useBrowserNotifications: e.target.checked }))}
              />
              <span>Use browser notifications for save confirmations (when no custom notify handler is set)</span>
            </label>
          </fieldset>
        </div>

        <footer className="settings-modal__foot">
            <button type="button" className="button-secondary" onClick={() => void reset()} disabled={saving}>
            Reset defaults
          </button>
          <div className="settings-modal__foot-actions">
            <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="element-editor__save" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
