import { useEffect, useRef, useState } from 'react'
import { MENU, type MenuEntry } from '@shared/menu'
import { emitMenuCommand } from '../lib/useMenuCommand'
import { WidowMark } from './WidowMark'

/** Cmd+Shift+O reads better than the raw accelerator string the native menu wants. */
function prettyAccelerator(accelerator: string | undefined, platform: string): string {
  if (!accelerator) return ''
  const mac = platform === 'darwin'
  return accelerator
    .replace('CmdOrCtrl', mac ? '⌘' : 'Ctrl')
    .replace('Shift', mac ? '⇧' : 'Shift')
    .replace('Plus', '+')
    .split('+')
    .filter(Boolean)
    .join(mac ? '' : '+')
}

function Item({ entry, platform, onRun }: { entry: MenuEntry; platform: string; onRun: () => void }) {
  const [open, setOpen] = useState(false)
  if (entry.separator) return <div className="menu-sep" role="separator" />
  if (entry.submenu) {
    return (
      <div className="menu-item has-sub" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <span>{entry.label}</span>
        <span className="menu-arrow">›</span>
        {open ? (
          <div className="menu-drop nested">
            {entry.submenu.map((child, i) => (
              <Item key={child.label ?? `sep-${i}`} entry={child} platform={platform} onRun={onRun} />
            ))}
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="menu-item"
      onClick={() => {
        if (entry.role) void window.spydr?.execRole?.(entry.role)
        else if (entry.command) emitMenuCommand(entry.command)
        onRun()
      }}
    >
      <span>{entry.label}</span>
      <span className="menu-accel">{prettyAccelerator(entry.accelerator, platform)}</span>
    </button>
  )
}

/**
 * The menu bar drawn inside the window, the way VS Code does on Windows and Linux. macOS keeps the
 * system menu bar instead, so this is not rendered there.
 */
export function TitleBar({ platform }: { platform: string }) {
  const [openSection, setOpenSection] = useState<string | null>(null)
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openSection) return
    const close = (e: MouseEvent): void => {
      if (!bar.current?.contains(e.target as Node)) setOpenSection(null)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpenSection(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [openSection])

  return (
    <div className="titlebar" ref={bar}>
      <span className="titlebar-mark" aria-hidden>
        <WidowMark size={15} />
      </span>
      <nav className="titlebar-menu" aria-label="Application menu">
        {MENU.map((section) => (
          <div key={section.label} className="menu-section">
            <button
              type="button"
              className={openSection === section.label ? 'menu-title active' : 'menu-title'}
              aria-expanded={openSection === section.label}
              onClick={() => setOpenSection((cur) => (cur === section.label ? null : section.label))}
              // Once a menu is open, hovering the others opens them, as a menu bar should.
              onMouseEnter={() => setOpenSection((cur) => (cur ? section.label : cur))}
            >
              {section.label}
            </button>
            {openSection === section.label ? (
              <div className="menu-drop">
                {section.items.map((entry, i) => (
                  <Item
                    key={entry.label ?? `sep-${i}`}
                    entry={entry}
                    platform={platform}
                    onRun={() => setOpenSection(null)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>
      <span className="titlebar-title">Spydr</span>
    </div>
  )
}
