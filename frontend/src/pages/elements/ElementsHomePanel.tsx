import { Link } from 'react-router-dom'
import { IconLightbulb, IconPanelLeft } from '../../components/ui/icons'

export function ElementsHomePanel() {
  return (
    <div className="elements-main-panel">
      <h2 className="icon-label">
        <IconPanelLeft size={22} />
        <span>Main</span>
      </h2>
      <p className="muted">
        Pick a type and an <strong>element</strong> leaf in the tag tree to open it here, or use{' '}
        <strong>New</strong> in the toolbar to create with a chosen type.
      </p>
      <p>
        <Link to="/elements/new?type=Idea" className="icon-label">
          <IconLightbulb size={16} />
          <span>Quick create Idea</span>
        </Link>
      </p>
    </div>
  )
}
