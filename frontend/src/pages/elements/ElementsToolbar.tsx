import { Link } from 'react-router-dom'
import { IconBookOpen, IconNetwork, IconPlus, IconStore, TypeGlyph } from '../../components/ui/icons'
import { ELEMENT_TYPE_OPTIONS } from '../../constants/elementTypes'

export function ElementsToolbar() {
  return (
    <div className="elements-toolbar">
      <div className="elements-toolbar__group">
        <span className="elements-toolbar__label icon-label">
          <IconPlus size={15} />
          New
        </span>
        {ELEMENT_TYPE_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            className="elements-toolbar__btn icon-label"
            to={`/elements/new?type=${encodeURIComponent(opt.value)}`}
            title={`New ${opt.value}`}
          >
            <TypeGlyph type={opt.value} size={17} />
            <span className="sr-only">New {opt.value}</span>
          </Link>
        ))}
      </div>
      <div className="elements-toolbar__group">
        <Link className="elements-toolbar__link icon-label" to="/graph" title="Graph explorer">
          <IconNetwork size={16} />
          <span>Graph</span>
        </Link>
        <Link className="elements-toolbar__link icon-label" to="/composer" title="Composer">
          <IconBookOpen size={16} />
          <span>Composer</span>
        </Link>
        <Link className="elements-toolbar__link icon-label" to="/marketplace" title="Marketplace">
          <IconStore size={16} />
          <span>Marketplace</span>
        </Link>
      </div>
    </div>
  )
}
