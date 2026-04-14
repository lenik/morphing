import { useMemo, useState } from 'react'
import type { Element } from '../api/types'
import type { SlotFieldDef } from '../domain/elementSlotsTypes'
import { getViewConfig } from '../domain/elementSlots'
import { IconClapperboard, IconDatabase, IconGitBranch, IconLayers, IconZap } from './ui/icons'
import { SlotFieldIcon, SlotGroupIcon } from './slotIcons'

type Props = {
  typeHint: string
  element: Element
  slotValues: Record<string, string>
  onSlotChange: (key: string, value: string) => void
  onSlotDelete?: (key: string) => void
  shotOrder?: string
  onShotOrderChange?: (v: string) => void
}

export function ElementSlotForm({
  typeHint,
  element,
  slotValues,
  onSlotChange,
  onSlotDelete = () => undefined,
  shotOrder = '',
  onShotOrderChange = () => undefined,
}: Props) {
  const cfg = getViewConfig(typeHint)
  const grouped = useMemo(() => groupSlots(cfg.slots), [cfg.slots])
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const knownKeys = useMemo(() => new Set(cfg.slots.map((s) => s.key)), [cfg.slots])
  const customEntries = useMemo(
    () =>
      Object.entries(slotValues)
        .filter(([k]) => !knownKeys.has(k))
        .sort((a, b) => a[0].localeCompare(b[0])),
    [slotValues, knownKeys],
  )

  if (cfg.slots.length === 0 && typeHint !== 'Shot') return null

  return (
    <div className="element-slots">
      <h4 className="element-slots__title icon-label">
        <IconLayers size={16} />
        <span>Structured slots</span>
      </h4>
      {grouped.map(({ title, fields }) => (
        <div key={title} className="element-slots__group-block">
          <h5 className="element-slots__group-title icon-label">
            <SlotGroupIcon title={title} />
            <span>{title}</span>
          </h5>
          <div className="element-slots__grid">
            {fields.map((f) => (
              <SlotField key={f.key} def={f} value={slotValues[f.key] ?? ''} onChange={(v) => onSlotChange(f.key, v)} />
            ))}
          </div>
        </div>
      ))}
      {typeHint === 'Shot' ? (
        <div className="element-slots__group-block">
          <h5 className="element-slots__group-title icon-label">
            <SlotGroupIcon title="Order" />
            <span>Order</span>
          </h5>
          <div className="element-slots__grid">
            <label className="create-form__field">
              <span className="icon-label">
                <SlotFieldIcon def={{ key: 'metadata_order', label: 'Sort order (metadata.order)' }} />
                Sort order (metadata.order)
              </span>
              <input
                inputMode="numeric"
                value={shotOrder}
                onChange={(e) => onShotOrderChange(e.target.value)}
                placeholder="Integer sort key"
              />
            </label>
          </div>
        </div>
      ) : null}
      <div className="element-slots__group-block">
        <h5 className="element-slots__group-title icon-label">
          <SlotGroupIcon title="Custom facets" />
          <span>Custom facets</span>
        </h5>
        <div className="element-slots__grid">
          {customEntries.map(([k, v]) => (
            <label key={k} className="create-form__field">
              <span className="icon-label">
                <SlotFieldIcon def={{ key: k, label: k }} />
                {k}
              </span>
              <div className="row" style={{ gap: '0.45rem' }}>
                <input value={v} onChange={(e) => onSlotChange(k, e.target.value)} />
                <button type="button" className="button-secondary" onClick={() => onSlotDelete(k)}>
                  Remove
                </button>
              </div>
            </label>
          ))}
          <label className="create-form__field">
            <span>New custom key (snake_case)</span>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. prop_symbolism" />
          </label>
          <label className="create-form__field">
            <span>Initial value</span>
            <textarea value={newValue} onChange={(e) => setNewValue(e.target.value)} rows={2} />
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                const kk = newKey.trim()
                if (!kk || !/^[a-z][a-z0-9_]*$/.test(kk)) return
                onSlotChange(kk, newValue)
                setNewKey('')
                setNewValue('')
              }}
            >
              Add custom facet
            </button>
          </label>
        </div>
      </div>
      <SystemMetaReadOnly element={element} typeHint={typeHint} />
    </div>
  )
}

function groupSlots(slots: SlotFieldDef[]): { title: string; fields: SlotFieldDef[] }[] {
  const m = new Map<string, SlotFieldDef[]>()
  for (const f of slots) {
    const title = f.group?.trim() || 'Fields'
    if (!m.has(title)) m.set(title, [])
    m.get(title)!.push(f)
  }
  return [...m.entries()].map(([title, fields]) => ({ title, fields }))
}

function SlotField({
  def,
  value,
  onChange,
}: {
  def: SlotFieldDef
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="create-form__field">
      <span className="icon-label">
        <SlotFieldIcon def={def} />
        {def.label}
      </span>
      {def.multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={def.placeholder}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} />
      )}
    </label>
  )
}

function SystemMetaReadOnly({ element, typeHint }: { element: Element; typeHint: string }) {
  const md = (element.metadata || {}) as Record<string, unknown>

  if (typeHint === 'Story' && md.composer) {
    return (
      <div className="element-system-meta">
        <h4 className="element-system-meta__title icon-label">
          <IconDatabase size={16} />
          <span>Composer</span>
        </h4>
        <pre className="element-system-meta__pre">{JSON.stringify(md.composer, null, 2)}</pre>
      </div>
    )
  }
  if (typeHint === 'Script' && md.derived_from) {
    return (
      <div className="element-system-meta">
        <h4 className="element-system-meta__title icon-label">
          <IconGitBranch size={16} />
          <span>Derived from</span>
        </h4>
        <p className="muted">Story element id: {String(md.derived_from)}</p>
      </div>
    )
  }
  if (typeHint === 'Storyboard' && (md.script_id != null || md.shot_order != null)) {
    return (
      <div className="element-system-meta">
        <h4 className="element-system-meta__title icon-label">
          <IconDatabase size={16} />
          <span>System fields</span>
        </h4>
        <ul className="muted" style={{ fontSize: '0.88rem' }}>
          {md.script_id != null ? <li>script_id: {String(md.script_id)}</li> : null}
          {md.shot_order != null ? <li>shot_order: {JSON.stringify(md.shot_order)}</li> : null}
        </ul>
      </div>
    )
  }
  if (typeHint === 'Shot' && md.storyboard_id != null) {
    return (
      <div className="element-system-meta">
        <h4 className="element-system-meta__title icon-label">
          <IconClapperboard size={16} />
          <span>Parent</span>
        </h4>
        <p className="muted">storyboard_id: {String(md.storyboard_id)}</p>
      </div>
    )
  }
  if (md.ai_slots && (typeHint === 'Character' || typeHint === 'Scene' || typeHint === 'Story')) {
    return (
      <div className="element-system-meta">
        <h4 className="element-system-meta__title icon-label">
          <IconZap size={16} />
          <span>AI extraction</span>
        </h4>
        <pre className="element-system-meta__pre">{JSON.stringify(md.ai_slots, null, 2)}</pre>
      </div>
    )
  }
  return null
}
