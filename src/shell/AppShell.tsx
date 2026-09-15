import type { WorkspaceId } from '@shared/types'
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

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="1.6" />
        <path d="M8 2.2v3.2M8 10.6v3.2M2.2 8h3.2M10.6 8h3.2M4 4l2.2 2.2M9.8 9.8 12 12M12 4 9.8 6.2M6.2 9.8 4 12" />
      </svg>
    </span>
  )
}

export function AppShell() {
  const { snapshot, workspace, setWorkspace, search, setSearch, disconnect } = useApp()
  if (!snapshot) return null

  return (
    <div className="app">
      <nav className="rail">
        <div className="brand">
          <BrandMark />
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
            Close sample
          </button>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <span className="pill">Sample directory</span>
          <span className="muted">{snapshot.dcHost}</span>
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
          <span className="muted">
            {snapshot.findings.length} findings · ingested {new Date(snapshot.ingestedAt).toLocaleString()}
          </span>
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
