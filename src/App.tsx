import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BridgeMismatch } from './components/BridgeMismatch'
import { TitleBar } from './components/TitleBar'
import { useMenuCommand } from './lib/useMenuCommand'
import { AppProvider, useApp } from './state'
import { AppShell } from './shell/AppShell'
import { Activate } from './workspaces/Activate'
import { Connect } from './workspaces/Connect'
import { Help } from './workspaces/Help'
import { Settings } from './workspaces/Settings'

/**
 * Settings and the guide with no directory open. Thresholds, privacy, connection defaults and the
 * help someone needs to make sense of the connect screen are all things wanted before a first
 * bind, so none of them can live behind one.
 */
function Standalone({ view }: { view: 'settings' | 'help' }) {
  const { setWorkspace } = useApp()
  return (
    <div className="settings-standalone">
      <header>
        <button type="button" className="linkish" onClick={() => setWorkspace('directory')}>
          <ChevronLeft size={14} aria-hidden /> Back to start
        </button>
        <span className="muted">{view === 'help' ? 'SPYDR guide' : 'SPYDR settings'}</span>
      </header>
      {view === 'help' ? <Help /> : <Settings />}
    </div>
  )
}

function Gate() {
  const { snapshot, workspace, setWorkspace, openSample, restoreSession, disconnect, openHelp, licence } = useApp()

  // Commands that apply whether or not a directory is open.
  useMenuCommand((command) => {
    if (command === 'file:sample') openSample()
    else if (command === 'file:restore') void restoreSession()
    else if (command === 'file:connect') disconnect()
    else if (command === 'view:settings') setWorkspace('settings')
    else if (command === 'help:docs') openHelp()
  })

  if (snapshot) return <AppShell />
  if (workspace === 'settings' || workspace === 'help') return <Standalone view={workspace} />
  // Activation comes first on a fresh install, but never stands between anyone and the sample.
  if (licence.status === 'none') return <Activate />
  return <Connect />
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
        <BridgeMismatch />
        <Gate />
      </div>
    </AppProvider>
  )
}
