import { AppProvider, useApp } from './state'
import { AppShell } from './shell/AppShell'
import { Connect } from './workspaces/Connect'

function Gate() {
  const { snapshot } = useApp()
  return snapshot ? <AppShell /> : <Connect />
}

export function App() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  )
}
