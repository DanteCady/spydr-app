import { Check, Palette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp, type Theme } from '../state'

/**
 * The theme control. Cycling through themes on click meant you could not see what you were choosing
 * before you chose it, so this opens a menu instead and shows each palette as three swatches: the
 * page, the accent, and the line work.
 */
const THEMES: { id: Theme; label: string; hint: string; swatches: [string, string, string] }[] = [
  { id: 'dark', label: 'Dark', hint: 'Deep navy, teal accent', swatches: ['#0b1220', '#14b8a6', '#1e2a3a'] },
  { id: 'light', label: 'Light', hint: 'Cool grey, teal accent', swatches: ['#edf1f8', '#0f766e', '#c6d0e0'] },
  { id: 'vivid', label: 'Vivid', hint: 'Colour by object type', swatches: ['#f6f8fa', '#2563eb', '#f59e0b'] },
  { id: 'minimal', label: 'Minimal', hint: 'Black, white, nothing else', swatches: ['#ffffff', '#000000', '#eaeaea'] }
]

export function ThemeMenu({ variant = 'icon' }: { variant?: 'icon' | 'inline' }) {
  const { theme, setTheme } = useApp()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="theme-wrap" ref={wrap}>
      <button
        type="button"
        className={variant === 'icon' ? 'icon-btn' : 'tb-btn'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}. Choose a theme.`}
        title={`Theme: ${current.label}`}
        onClick={() => setOpen((on) => !on)}
      >
        {variant === 'icon' ? (
          <Palette size={14} aria-hidden />
        ) : (
          <>
            <span className="theme-swatch" aria-hidden>
              {current.swatches.map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
            {current.label}
          </>
        )}
      </button>

      {open ? (
        <div className="theme-pop" role="menu">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === theme}
              className={t.id === theme ? 'active' : ''}
              onClick={() => {
                setTheme(t.id)
                setOpen(false)
              }}
            >
              <span className="theme-swatch" aria-hidden>
                {t.swatches.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="theme-name">
                <strong>{t.label}</strong>
                <em>{t.hint}</em>
              </span>
              {t.id === theme ? <Check size={13} className="theme-check" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
