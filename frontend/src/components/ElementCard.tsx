import { Link } from 'react-router-dom'
import type { Element } from '../api/types'

type Props = {
  element: Element
}

export function ElementCard({ element }: Props) {
  return (
    <article className="element-card">
      <header className="element-card__head">
        <span className="element-card__type">{element.type_hint}</span>
        <Link to={`/elements/${element.id}`} className="element-card__title">
          {element.title || '(untitled)'}
        </Link>
      </header>
      {element.content ? (
        <p className="element-card__excerpt">{element.content.slice(0, 160)}{element.content.length > 160 ? '…' : ''}</p>
      ) : null}
      {element.tags.length > 0 ? (
        <ul className="element-card__tags">
          {element.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      <footer className="element-card__meta">
        <span>v{element.version}</span>
        {element.author ? <span>{element.author}</span> : null}
      </footer>
    </article>
  )
}
