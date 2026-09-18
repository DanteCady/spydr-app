import { useEffect, useState } from 'react'
import { TitleBar } from './components/TitleBar'
import { useMenuCommand } from './lib/useMenuCommand'
import { AppProvider, useApp } from './state'
import { AppShell } from './shell/AppShell'
import { Connect } from './workspaces/Connect'

function Gate() {
  const { snapshot, openSample, restoreSession, disconnect } = useApp()

  // Commands that apply whether or not a directory is open.
  useMenuCommand((command) => {
    if (command === 'file:sample') openSample()
    else if (command === 'file:restore') void restoreSession()
    else if (command === 'file:connect') disconnect()
  })

  return snapshot ? <AppShell /> : <Connect />
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
