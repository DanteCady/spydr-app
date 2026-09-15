import { ObjectPicker } from '../components/ObjectPicker'
import { SeverityBadge } from '../components/SeverityBadge'
import { useApp } from '../state'

export function Pathfinder() {
  const { snapshot, pathSource, pathTarget, setPathSource, setPathTarget, paths, select, goTo, activeFinding } = useApp()
  if (!snapshot) return null

  const people = snapshot.nodes.filter((n) => n.type === 'user' || n.type === 'group')
  const groups = snapshot.nodes.filter((n) => n.type === 'group')
  const privileged = groups.filter((n) => n.privileged)

  return (
    <div className="split-list">
      <div className="path-form">
        <label>
          Source
          <ObjectPicker nodes={people} value={pathSource} onChange={setPathSource} placeholder="Type a user or group…" />
        </label>
        <label>
          Target group
          <ObjectPicker nodes={groups} value={pathTarget} onChange={setPathTarget} placeholder="Type a group…" />
        </label>
      </div>
      <div className="toolbar">
        <span className="muted">Shortcuts</span>
        {privileged.map((g) => (
          <button key={g.id} type="button" className="linkish" onClick={() => setPathTarget(g.id)}>
            {g.sAMAccountName}
          </button>
        ))}
      </div>
      <div className="scroll">
        {activeFinding ? (
          <div className="path-card">
            <SeverityBadge severity={activeFinding.severity} /> {activeFinding.title}
            <p>{activeFinding.detail}</p>
            <p className="suggested">{activeFinding.suggestedFix}</p>
          </div>
        ) : null}
        {!pathSource || !pathTarget ? (
          <p className="empty">Pick a source and a target to see nested membership paths. Sample: Alice Chen → Domain Admins.</p>
        ) : paths.length === 0 ? (
          <p className="empty">No nested path from the source into that group.</p>
        ) : (
          paths.map((p, i) => (
            <div className="path-card" key={p.nodeIds.join('>')}>
              <div className="muted">
                Path {i + 1} · {p.nodeIds.length - 1} hop{p.nodeIds.length - 1 === 1 ? '' : 's'}
              </div>
              <ol>
                {p.labels.map((name, idx) => (
                  <li key={p.nodeIds[idx]}>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => {
                        select(p.nodeIds[idx])
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" className="linkish" onClick={() => goTo('web', p.nodeIds[0])}>
                Show source in Web
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
