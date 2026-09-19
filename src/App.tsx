import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TitleBar } from './components/TitleBar'
import { useMenuCommand } from './lib/useMenuCommand'
import { AppProvider, useApp } from './state'
import { AppShell } from './shell/AppShell'
import { Connect } from './workspaces/Connect'
import { Settings } from './workspaces/Settings'

/**
 * Settings with no directory open. Thresholds, privacy and the connection defaults are exactly the
 * things someone wants to set before binding for the first time, so they cannot live behind a
 * connection.
 */
function StandaloneSettings() {
  const { setWorkspace } = useApp()
  return (
    <div className="settings-standalone">
      <header>
        <button type="button" className="linkish" onClick={() => setWorkspace('directory')}>
          <ChevronLeft size={14} aria-hidden /> Back to start
        </button>
        <span className="muted">SPYDR settings</span>
      </header>
      <Settings />
    </div>
  )
}

function Gate() {
  const { snapshot, workspace, setWorkspace, openSample, restoreSession, disconnect } = useApp()

  // Commands that apply whether or not a directory is open.
  useMenuCommand((command) => {
    if (command === 'file:sample') openSample()
    else if (command === 'file:restore') void restoreSession()
    else if (command === 'file:connect') disconnect()
    else if (command === 'view:settings') setWorkspace('settings')
  })

  if (snapshot) return <AppShell />
  return workspace === 'settings' ? <StandaloneSettings /> : <Connect />
}

export function App() {
  // Windows and Linux draw their own bar; macOS uses the system menu bar, as VS Code does.
  const [chrome, setChrome] = useState<{ custom: boolean; platform: string; titleBarHeight: number } | null>(null)
  useEffect(() => {
    setChrome(window.spydr?.chrome?.() ?? { custom: false, platform: 'browser', titleBarHeight: 0 })
  }, [])
  useEffect(() => {
    document.documentElement.style.setProperty('--titlebar', chrome?.custom ? `${chrome.titleBarHeight}px` : '0px')
  }, [chrome])

  return (
    <AppProvider>
      {chrome?.custom ? <TitleBar platform={chrome.platform} /> : null}
      <div className="app-body">
        <Gate />
      </div>
    </AppProvider>
  )
}
