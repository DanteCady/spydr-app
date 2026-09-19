import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Development only: catches the window running ahead of the process behind it.
 *
 * electron-vite hot-reloads the interface but builds the main process once, at startup. Add an IPC
 * handler and the window picks it up immediately while main knows nothing about it — so the new
 * feature silently does nothing, which looks exactly like a bug in the feature. This turns that
 * into an instruction.
 *
 * Add the bridge methods a feature introduces to the list below; a name here that main does not
 * expose is the whole signal.
 */
const EXPECTED = [
  'ingest',
  'refresh',
  'settingsSync',
  'timelineList',
  'timelineSample',
  'telemetryPreview',
  'licence',
  'activate',
  'about'
] as const

export function BridgeMismatch() {
  const [missing, setMissing] = useState<string[]>([])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const bridge = window.spydr as unknown as Record<string, unknown> | undefined
    if (!bridge) return
    setMissing(EXPECTED.filter((name) => typeof bridge[name] !== 'function'))
  }, [])

  if (missing.length === 0) return null

  return (
    <div className="bridge-warning" role="alert">
      <RefreshCw size={14} aria-hidden />
      <div>
        <strong>This window is newer than the process behind it.</strong>
        <span>
          {missing.length === 1 ? `${missing[0]} is` : `${missing.length} bridge methods are`} missing, so anything
          relying on {missing.length === 1 ? 'it' : 'them'} will quietly do nothing. Restart <code>npm run dev</code> —
          the main process only builds at startup.
        </span>
      </div>
    </div>
  )
}
