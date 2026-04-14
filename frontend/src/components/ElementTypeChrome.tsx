import { Link } from 'react-router-dom'
import type { Element } from '../api/types'
import { IconBookOpen, IconCamera, IconClapperboard, IconFileText, TypeGlyph } from './ui/icons'

const HINTS: Record<string, { title: string; desc: string; className: string }> = {
  Idea: {
    title: 'Idea',
    desc: 'Loose sparks, themes, and fragments before they become scenes or characters.',
    className: 'type-chrome type-chrome--idea',
  },
  Character: {
    title: 'Character',
    desc: 'Looks, personality, motivation, and relationships; the body field holds long-form bio text.',
    className: 'type-chrome type-chrome--character',
  },
  Scene: {
    title: 'Scene',
    desc: 'Space, time, mood, and key props; the body field holds environment and blocking notes.',
    className: 'type-chrome type-chrome--scene',
  },
  Story: {
    title: 'Story',
    desc: 'Structure, conflict, and beats; combine cast and locations in Composer when you are ready.',
    className: 'type-chrome type-chrome--story',
  },
  Script: {
    title: 'Script',
    desc: 'Scenes, dialogue, and stage directions; open the wide script editor for layout work.',
    className: 'type-chrome type-chrome--script',
  },
  Storyboard: {
    title: 'Storyboard',
    desc: 'Shot sequences and visual paragraphs; shots hang under this board.',
    className: 'type-chrome type-chrome--storyboard',
  },
  Shot: {
    title: 'Shot',
    desc: 'Single-shot picture and motion; batch prompts from the visual tools when needed.',
    className: 'type-chrome type-chrome--shot',
  },
  Collection: {
    title: 'Collection',
    desc: 'A bundle of element references; use the gallery to add members and morph into a new typed element.',
    className: 'type-chrome type-chrome--collection',
  },
}

type Props = {
  element: Element
  elementId: string
}

export function ElementTypeChrome({ element, elementId }: Props) {
  const hint = HINTS[element.type_hint] ?? {
    title: element.type_hint,
    desc: 'Generic element.',
    className: 'type-chrome type-chrome--default',
  }
  const order = (element.metadata as Record<string, unknown> | undefined)?.order

  return (
    <div className={hint.className}>
      <div className="type-chrome__head">
        <strong className="type-chrome__title-row icon-label">
          <TypeGlyph type={element.type_hint} size={20} />
          <span>{hint.title}</span>
        </strong>
        <span className="type-chrome__desc">{hint.desc}</span>
      </div>
      <div className="type-chrome__links">
        {element.type_hint === 'Script' ? (
          <Link to={`/scripts/${elementId}`} className="type-chrome__link icon-label">
            <IconFileText size={14} />
            <span>Wide script editor</span>
          </Link>
        ) : null}
        {element.type_hint === 'Storyboard' ? (
          <>
            <Link to={`/storyboards/${elementId}`} className="type-chrome__link icon-label">
              <IconClapperboard size={14} />
              <span>Shot list</span>
            </Link>
            <Link to={`/visual/${elementId}`} className="type-chrome__link icon-label">
              <IconCamera size={14} />
              <span>Visual batch</span>
            </Link>
          </>
        ) : null}
        {element.type_hint === 'Story' ? (
          <Link to="/composer" className="type-chrome__link icon-label">
            <IconBookOpen size={14} />
            <span>Composer</span>
          </Link>
        ) : null}
        {element.type_hint === 'Shot' && order != null ? (
          <span className="muted icon-label">
            <IconCamera size={14} />
            <span>order: {String(order)}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}
