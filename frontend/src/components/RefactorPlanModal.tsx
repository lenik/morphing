import { IconRefreshCw, TypeGlyph } from './ui/icons'
import { getElementTier } from '../domain/elementTier'

export type RefactorPlanItem = {
  id: string
  title: string
  type_hint: string
}

type Props = {
  open: boolean
  items: RefactorPlanItem[]
  progressIndex: number
  running: boolean
  onClose: () => void
}

export function RefactorPlanModal({ open, items, progressIndex, running, onClose }: Props) {
  if (!open) return null
  const total = items.length
  const pct = total === 0 ? 100 : Math.min(100, Math.round((progressIndex / total) * 100))
  const done = !running && (total === 0 || progressIndex >= total)

  return (
    <div className="refactor-modal" role="presentation">
      <button type="button" className="refactor-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="refactor-modal__panel" role="dialog" aria-modal="true" aria-labelledby="refactor-modal-title">
        <header className="refactor-modal__head">
          <h2 id="refactor-modal-title" className="refactor-modal__title icon-label">
            <IconRefreshCw size={20} />
            <span>Refactor plan</span>
          </h2>
          <p className="refactor-modal__sub muted">
            Downstream elements ordered by tier (demo: simulated parallel progress).
          </p>
        </header>
        <div className="refactor-modal__progress-wrap">
          <div className="refactor-modal__progress-bar">
            <div className="refactor-modal__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="refactor-modal__progress-label">
            {total === 0 ? 'No downstream nodes' : `${Math.min(progressIndex, total)} / ${total}`}
          </span>
        </div>
        <ul className="refactor-modal__list">
          {items.map((it, i) => (
            <li
              key={it.id}
              className={
                'refactor-modal__row' +
                (running && progressIndex < total && i === progressIndex ? ' refactor-modal__row--active' : '') +
                (i < progressIndex ? ' refactor-modal__row--done' : '')
              }
            >
              <span className="refactor-modal__tier">t{getElementTier(it.type_hint)}</span>
              <TypeGlyph type={it.type_hint} size={14} />
              <span className="refactor-modal__name">{it.title || it.id.slice(0, 8)}</span>
              <code className="refactor-modal__id">{it.id.slice(0, 8)}…</code>
            </li>
          ))}
        </ul>
        {done ? (
          <p className="refactor-modal__done muted">Demo finished — no downstream AI calls were made.</p>
        ) : null}
        <footer className="refactor-modal__foot">
          <button type="button" className="button-secondary" onClick={onClose} disabled={running}>
            {running ? 'Running…' : 'Close'}
          </button>
        </footer>
      </div>
    </div>
  )
}
