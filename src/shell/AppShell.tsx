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
          <input
            type="search"
            placeholder="Find name, SAM, UPN…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (e.target.value) setWorkspace('directory')
            }}
          />
          <span className="spacer" />
          <button type="button" className="linkish" onClick={() => setWorkspace('hygiene')}>
            {snapshot.findings.length} finding{snapshot.findings.length === 1 ? '' : 's'}
          </button>
          <span className="muted">ingested {new Date(snapshot.ingestedAt).toLocaleString()}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 16 16" aria-hidden>
                <circle cx="8" cy="8" r="3.2" />
                <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M13.5 9.7A5.8 5.8 0 1 1 6.3 2.5a4.6 4.6 0 1 0 7.2 7.2z" />
              </svg>
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
