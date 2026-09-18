import { useEffect, useRef } from 'react'

const listeners = new Set<(command: string) => void>()

/** Fire a command from the in-window menu bar, down the same path the native menu uses. */
export function emitMenuCommand(command: string): void {
  for (const listener of [...listeners]) listener(command)
}

/**
 * Run a handler when a menu command fires, from either the native menu or the drawn one. The
 * handler is kept in a ref so callers can close over current state without resubscribing.
 */
export function useMenuCommand(handler: (command: string) => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const listener = (command: string): void => ref.current(command)
    listeners.add(listener)
    const off = window.spydr?.onMenuCommand?.(listener)
    return () => {
      listeners.delete(listener)
      off?.()
    }
  }, [])
}
