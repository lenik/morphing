import { useEffect, useRef, useState } from 'react'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { AiChatPanel } from './components/AiChatPanel'
import { SettingsModal } from './components/SettingsModal'
import { IconBookOpen, IconLayers, IconMessageSquare, IconNetwork, IconSettings, IconStore } from './components/ui/icons'
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
  const [isPortrait, setIsPortrait] = useState(false)
  const [appMenuVisible, setAppMenuVisible] = useState(true)
  const [aiPanelVisible, setAiPanelVisible] = useState(true)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    const check = () => setIsPortrait(window.matchMedia('(orientation: portrait)').matches)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isPortrait) {
      setAppMenuVisible(false)
      setAiPanelVisible(false)
    } else {
      setAppMenuVisible(true)
      setAiPanelVisible(true)
    }
  }, [isPortrait])

  const onTopbarTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    touchStartY.current = e.touches[0]?.clientY ?? null
  }

  const onTopbarTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (!isPortrait) return
    const y0 = touchStartY.current
    const y1 = e.changedTouches[0]?.clientY
    touchStartY.current = null
    if (y0 == null || y1 == null) return
    if (y1 - y0 >= 36) setAppMenuVisible(true)
  }

  const showAiPanelEffective = showAiPanel && aiPanelVisible
  return (
    <div className="app-shell">
      <header className={`topbar ${isPortrait ? 'topbar--portrait' : ''}`} onTouchStart={onTopbarTouchStart} onTouchEnd={onTopbarTouchEnd}>
        <Link to="/" className="brand">
          Morphing
        </Link>
        <nav className={`topbar__nav ${appMenuVisible ? '' : 'topbar__nav--hidden'}`}>
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
        {showAiPanel ? (
          <button
            type="button"
            className={`topbar__settings-btn icon-label ${aiPanelVisible ? 'is-active' : ''}`}
            onClick={() => setAiPanelVisible((v) => !v)}
            title="Toggle AI chat panel"
            aria-label="Toggle AI chat panel"
          >
            <IconMessageSquare size={16} />
            <span>AI</span>
          </button>
        ) : null}
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
        {showAiPanelEffective ? <AiChatPanel /> : null}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppSettingsProvider>
        <AiChatProvider>
          <AppShell />
        </AiChatProvider>
      </AppSettingsProvider>
    </HashRouter>
  )
}
