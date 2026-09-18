import { Moon, Palette, Search, Sun } from 'lucide-react'
import type { WorkspaceId } from '@shared/types'
import { NavGlyph } from '../components/NavGlyph'
import { WidowMark } from '../components/WidowMark'
import { ObjectInspector } from '../inspector/ObjectInspector'
import { useApp } from '../state'
import { Directory } from '../workspaces/Directory'
import { Hygiene } from '../workspaces/Hygiene'
import { Pathfinder } from '../workspaces/Pathfinder'
import { Web } from '../workspaces/Web'

const NAV: { id: WorkspaceId; label: string; hint: string }[] = [
  { id: 'directory', label: 'Directory', hint: 'ADUC' },
  { id: 'web', label: 'Web', hint: 'Nesting' },
  { id: 'pathfinder', label: 'Pathfinder', hint: 'How' },
  { id: 'hygiene', label: 'Hygiene', hint: 'Cleanup' }
]

/** The theme each button press moves to, so the control can say where it is going. */
const NEXT_THEME: Record<string, string> = { dark: 'light', light: 'vivid', vivid: 'dark' }

export function AppShell() {
  const { snapshot, workspace, setWorkspace, search, setSearch, disconnect, theme, toggleTheme } = useApp()
  if (!snapshot) return null

  return (
    <div className="app">
      <nav className="rail">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <WidowMark />
          </span>
          <div>
            <h1>Spydr</h1>
            <p>Read-only directory</p>
          </div>
        </div>
        <div className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={workspace === item.id ? 'active' : ''}
              onClick={() => setWorkspace(item.id)}
            >
              <NavGlyph id={item.id} />
              {item.label}
              <span className="hint">{item.hint}</span>
            </button>
          ))}
        </div>
        <div className="rail-foot">
          <div>
            {snapshot.domain}
            <br />
            {snapshot.stats.users} users · {snapshot.stats.groups} groups
          </div>
          <button type="button" onClick={disconnect}>
            {snapshot.source === 'fixture' ? 'Close sample' : 'Disconnect'}
          </button>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <span className="pill">{snapshot.source === 'fixture' ? 'SAMPLE' : snapshot.protocol?.toUpperCase() ?? 'LDAP'}</span>
          <span className="host">{snapshot.dcHost}</span>
          <label className="search-wrap">
            <Search size={14} aria-hidden />
            <input
              type="search"
              placeholder="Find name, SAM, UPN…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                if (e.target.value) setWorkspace('directory')
              }}
            />
          </label>
          <span className="spacer" />
          <button type="button" className="linkish" onClick={() => setWorkspace('hygiene')}>
            {snapshot.findings.length} finding{snapshot.findings.length === 1 ? '' : 's'}
          </button>
          <span className="muted">ingested {new Date(snapshot.ingestedAt).toLocaleString()}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}.`}
            title={`Theme: ${theme} — switch to ${NEXT_THEME[theme]}`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <Sun size={14} aria-hidden />
            ) : theme === 'light' ? (
              <Palette size={14} aria-hidden />
            ) : (
              <Moon size={14} aria-hidden />
            )}
          </button>
        </header>
        <div className="workspace">
          {workspace === 'directory' ? <Directory /> : null}
          {workspace === 'web' ? <Web /> : null}
          {workspace === 'pathfinder' ? <Pathfinder /> : null}
          {workspace === 'hygiene' ? <Hygiene /> : null}
          <ObjectInspector />
        </div>
      </div>
    </div>
  )
}
