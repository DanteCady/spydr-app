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
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  )
}
