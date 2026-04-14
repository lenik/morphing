import { useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { AiChatPanel } from './components/AiChatPanel'
import { SettingsModal } from './components/SettingsModal'
import { IconBookOpen, IconLayers, IconNetwork, IconSettings, IconStore } from './components/ui/icons'
import { AiChatProvider } from './context/AiChatContext'
import { AppSettingsProvider } from './context/AppSettingsContext'
import { ComposerPage } from './pages/ComposerPage'
import { CreatorDashboard } from './pages/CreatorDashboard'
import { DependencyView } from './pages/DependencyView'
import { ElementWorkspacePanel } from './pages/elements/ElementWorkspacePanel'
import { ElementCreatePanel } from './pages/elements/ElementCreatePanel'
import { ElementsHomePanel } from './pages/elements/ElementsHomePanel'
import { ElementsWorkspace } from './pages/elements/ElementsWorkspace'
import { GraphExplorer } from './pages/GraphExplorer'
import { MarketplacePage } from './pages/MarketplacePage'
import { ScriptEditor } from './pages/ScriptEditor'
import { MorphingPage } from './pages/MorphingPage'
import { StoryboardViewer } from './pages/StoryboardViewer'
import { VersionHistory } from './pages/VersionHistory'
import { VisualBatchPage } from './pages/VisualBatchPage'
import './App.css'

function Home() {
  return (
    <div className="page">
      <h1>Morphing</h1>
      <p className="lede">AI-native narrative collaboration — Element platform prototype.</p>
      <p>
        <Link to="/elements">Open elements</Link>
      </p>
    </div>
  )
}

function AppShell() {
  const loc = useLocation()
  const showAiPanel = loc.pathname.startsWith('/elements') || loc.pathname.startsWith('/composer')
  const fullWidth = showAiPanel
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Morphing
        </Link>
        <nav className="topbar__nav">
          <Link to="/elements" className="topbar__nav-link icon-label">
            <IconLayers size={15} />
            <span>Elements</span>
          </Link>
          <Link to="/graph" className="topbar__nav-link icon-label">
            <IconNetwork size={15} />
            <span>Graph</span>
          </Link>
          <Link to="/composer" className="topbar__nav-link icon-label">
            <IconBookOpen size={15} />
            <span>Composer</span>
          </Link>
          <Link to="/marketplace" className="topbar__nav-link icon-label">
            <IconStore size={15} />
            <span>Marketplace</span>
          </Link>
        </nav>
        <button
          type="button"
          className="topbar__settings-btn icon-label"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Open settings"
        >
          <IconSettings size={18} />
          <span>Settings</span>
        </button>
      </header>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <div className="app-shell__body">
        <main className={fullWidth ? 'main main--full' : 'main'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/elements" element={<ElementsWorkspace />}>
            <Route index element={<ElementsHomePanel />} />
            <Route path="new" element={<ElementCreatePanel />} />
            <Route path=":id" element={<ElementWorkspacePanel />} />
          </Route>
          <Route path="/graph" element={<GraphExplorer />} />
          <Route path="/composer" element={<ComposerPage />} />
          <Route path="/scripts/:id" element={<ScriptEditor />} />
          <Route path="/storyboards/:id" element={<StoryboardViewer />} />
          <Route path="/dependencies/:id" element={<DependencyView />} />
          <Route path="/creators/:author" element={<CreatorDashboard />} />
          <Route path="/morph/:id" element={<MorphingPage />} />
          <Route path="/versions/:id" element={<VersionHistory />} />
          <Route path="/visual/:id" element={<VisualBatchPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
        </Routes>
        </main>
        {showAiPanel ? <AiChatPanel /> : null}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppSettingsProvider>
        <AiChatProvider>
          <AppShell />
        </AiChatProvider>
      </AppSettingsProvider>
    </BrowserRouter>
  )
}
