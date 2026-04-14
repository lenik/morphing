import { Outlet } from 'react-router-dom'
import { ElementsProvider } from '../../context/ElementsDataContext'
import { ElementsSidebar } from './ElementsSidebar'
import { ElementsToolbar } from './ElementsToolbar'

export function ElementsWorkspace() {
  return (
    <ElementsProvider>
      <div className="elements-workspace">
        <ElementsToolbar />
        <div className="elements-workspace__body">
          <ElementsSidebar />
          <section className="elements-workspace__main">
            <Outlet />
          </section>
        </div>
      </div>
    </ElementsProvider>
  )
}
