/**
 * Accelerators, written the way the host platform writes them. One implementation, used by the
 * in-window menu bar and by the guide, so a shortcut never appears two ways in the same app.
 */

let cached: string | null = null

/** 'darwin', 'win32', 'linux' — from the main process, which actually knows. */
export function hostPlatform(): string {
  if (cached) return cached
  // Rendered on a server too — the website publishes these same articles as its documentation.
  if (typeof window === 'undefined') return 'other'
  const fromMain = window.spydir?.chrome?.().platform
  cached = fromMain ?? (/mac/i.test(navigator.userAgent) ? 'darwin' : 'other')
  return cached
}

export function prettyAccelerator(accelerator: string | undefined, platform = hostPlatform()): string {
  if (!accelerator) return ''
  const mac = platform === 'darwin'
  const names: Record<string, string> = {
    CmdOrCtrl: mac ? '⌘' : 'Ctrl',
    Cmd: '⌘',
    Ctrl: 'Ctrl',
    Shift: mac ? '⇧' : 'Shift',
    Alt: mac ? '⌥' : 'Alt',
    // Split before substituting, so a literal Plus is not mistaken for the separator.
    Plus: '+'
  }
  return accelerator
    .split('+')
    .map((part) => names[part] ?? part)
    .join(mac ? '' : '+')
}
