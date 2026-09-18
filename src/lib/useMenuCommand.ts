import { useEffect, useRef } from 'react'

/**
 * Run a handler when the application menu fires a command. The handler is kept in a ref so callers
 * can close over current state without resubscribing on every render.
 */
export function useMenuCommand(handler: (command: string) => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!window.spydr?.onMenuCommand) return
    return window.spydr.onMenuCommand((command) => ref.current(command))
  }, [])
}
