import { ArrowRight, Scissors, Waypoints } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildMembershipGraph, effectiveMembers, enumeratePaths, sharedLinks } from '@shared/graph'
import type { DirectoryNode } from '@shared/types'
import { EmptyState } from '../components/EmptyState'
import { FindingCard } from '../components/FindingCard'
import { ObjectPicker } from '../components/ObjectPicker'
import { TypeGlyph } from '../components/TypeGlyph'
import { useApp } from '../state'

type Mode = 'path' | 'members'

/** One step of a chain: "Alice Chen → member of → IT-Admins". */
function Chain({
  ids,
  labels,
  byId,
  onSelect
}: {
  ids: string[]
  labels: string[]
  byId: Map<string, DirectoryNode>
  onSelect: (id: string) => void
}) {
  return (
    <ol className="chain">
      {ids.map((id, i) => (
        <li key={id}>
          <button type="button" className="chain-node" onClick={() => onSelect(id)}>
            <TypeGlyph type={byId.get(id)?.type ?? 'group'} />
            {labels[i]}
          </button>
          {i < ids.length - 1 ? (
            <span className="chain-link" aria-label="is a member of">
              <ArrowRight size={13} aria-hidden />
              <em>member of</em>
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

export function Pathfinder() {
  const {
    snapshot,
    pathSource,
    pathTarget,
    setPathSource,
    setPathTarget,
    paths,
    select,
    goTo,
    traceInWeb,
    activeFinding,
    clearFinding
  } = useApp()
  const [mode, setMode] = useState<Mode>('path')

  const byId = useMemo(
    () => new Map((snapshot?.nodes ?? []).map((n) => [n.id, n] as const)),
    [snapshot]
  )
  const graph = useMemo(
    () => (snapshot ? buildMembershipGraph(snapshot.nodes, snapshot.edges) : null),
    [snapshot]
  )

  const source = byId.get(pathSource)
  const target = byId.get(pathTarget)

  const direct = useMemo(
    () => Boolean(snapshot?.edges.some((e) => e.from === pathSource && e.to === pathTarget)),
    [snapshot, pathSource, pathTarget]
  )
  const nested = paths.filter((p) => p.nodeIds.length > 2)
  const cuts = useMemo(() => (nested.length > 1 ? sharedLinks(nested) : []), [nested])

  // Every account inside the target group, direct or not — the access-review question.
  const inside = useMemo(() => {
    if (!graph || !pathTarget || mode !== 'members') return []
    return effectiveMembers(graph, pathTarget)
      .map((m) => ({ ...m, node: byId.get(m.id) }))
      .filter((m) => m.node && m.node.type !== 'group')
      .sort((a, b) => b.depth - a.depth || (a.node?.displayName ?? '').localeCompare(b.node?.displayName ?? ''))
  }, [graph, pathTarget, mode, byId])

  if (!snapshot) return null

  const people = snapshot.nodes.filter((n) => n.type === 'user' || n.type === 'group')
  const groups = snapshot.nodes.filter((n) => n.type === 'group')
  const privileged = groups.filter((n) => n.privileged)
  const indirect = inside.filter((m) => m.depth > 1).length

  return (
    <div className="split-list pathfinder">
      <div className="mode-switch" role="tablist" aria-label="What to ask">
        <button type="button" role="tab" aria-selected={mode === 'path'} className={mode === 'path' ? 'active' : ''} onClick={() => setMode('path')}>
          <Waypoints size={14} aria-hidden />
          How does an account reach a group?
        </button>
        <button type="button" role="tab" aria-selected={mode === 'members'} className={mode === 'members' ? 'active' : ''} onClick={() => setMode('members')}>
          <TypeGlyph type="group" />
          Who is really in a group?
        </button>
      </div>

      <div className="path-form">
        {mode === 'path' ? (
          <label>
            Account or group
            <ObjectPicker nodes={people} value={pathSource} onChange={setPathSource} placeholder="Type a user or group…" />
          </label>
        ) : null}
        <label>
          {mode === 'path' ? 'Target group' : 'Group to review'}
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
        {activeFinding ? <FindingCard finding={activeFinding} onDismiss={clearFinding} /> : null}

        {mode === 'path' ? (
          !source || !target ? (
            <EmptyState
              title="Pick an account and a group"
              hint="Active Directory shows direct members only. This walks the nesting to show every way in — including the ones a member list never reveals."
            />
          ) : (
            <>
              <div className="verdict">
                <h2>
                  {direct && nested.length > 0
                    ? `${source.displayName} is a direct member of ${target.displayName} — and also reaches it through nesting.`
                    : direct
                      ? `${source.displayName} is a direct member of ${target.displayName}.`
                      : nested.length > 0
                        ? `${source.displayName} is not a direct member of ${target.displayName}.`
                        : `${source.displayName} cannot reach ${target.displayName}.`}
                </h2>
                <p className="muted">
                  {nested.length > 0
                    ? `Membership arrives through ${nested.length === 1 ? 'one nested chain' : `${nested.length} nested chains`}. Removing the account from a group only revokes access if every chain is broken.`
                    : direct
                      ? 'Nothing is hidden behind nested groups here.'
                      : 'No membership chain connects the two, at any depth.'}
                </p>
              </div>

              {cuts.length > 0 ? (
                <div className="cut-card">
                  <Scissors size={14} aria-hidden />
                  <div>
                    <strong>
                      Every chain passes through {cuts.length === 1 ? 'one link' : `${cuts.length} links`}.
                    </strong>
                    <ul>
                      {cuts.map((link) => (
                        <li key={`${link.from}>${link.to}`}>
                          {byId.get(link.from)?.displayName ?? link.from}
                          <ArrowRight size={11} aria-hidden />
                          {byId.get(link.to)?.displayName ?? link.to}
                        </li>
                      ))}
                    </ul>
                    <span className="muted">Breaking any one of these cuts all {nested.length} chains at once.</span>
                  </div>
                </div>
              ) : null}

              {paths.map((p, i) => (
                <div className="path-card" key={p.nodeIds.join('>')}>
                  <div className="path-head">
                    <span className="muted">
                      Route {i + 1} · {p.nodeIds.length - 1} membership{p.nodeIds.length - 1 === 1 ? '' : 's'} deep
                      {p.nodeIds.length === 2 ? ' · direct' : ''}
                    </span>
                    <button type="button" className="linkish" onClick={() => traceInWeb(p.nodeIds[0], p.nodeIds[p.nodeIds.length - 1])}>
                      Trace on the canvas
                    </button>
                  </div>
                  <Chain ids={p.nodeIds} labels={p.labels} byId={byId} onSelect={select} />
                </div>
              ))}
            </>
          )
        ) : !target ? (
          <EmptyState
            title="Pick a group to review"
            hint="Its member list is only part of the answer. This lists every account that ends up inside it, however deeply nested."
          />
        ) : (
          <>
            <div className="verdict">
              <h2>
                {inside.length} account{inside.length === 1 ? '' : 's'} end{inside.length === 1 ? 's' : ''} up in{' '}
                {target.displayName}.
              </h2>
              <p className="muted">
                {indirect === 0
                  ? 'All of them are direct members, so the member list tells the whole story.'
                  : `${indirect} of them ${indirect === 1 ? 'is' : 'are'} not in the member list — they arrive through nested groups.`}
              </p>
            </div>
            {inside.length === 0 ? (
              <EmptyState title="Nobody is inside this group" hint="No account reaches it directly or through nesting." />
            ) : (
              <table className="grid members-grid">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>How</th>
                    <th>Route</th>
                  </tr>
                </thead>
                <tbody>
                  {inside.map((m) => {
                    const route = graph ? enumeratePaths(graph, m.id, pathTarget, { maxPaths: 1 })[0] : undefined
                    return (
                      <tr key={m.id} onClick={() => select(m.id)}>
                        <td>
                          <span className="name-cell">
                            <TypeGlyph type={m.node?.type ?? 'user'} />
                            {m.node?.displayName}
                          </span>
                        </td>
                        <td>
                          <span className={m.depth === 1 ? 'badge low' : 'badge medium'}>
                            {m.depth === 1 ? 'Direct' : `${m.depth} deep`}
                          </span>
                        </td>
                        <td className="muted">{route ? route.labels.join(' → ') : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <p className="muted grid-foot">
              Groups nested inside {target.displayName} are left out of the count — this is the list of accounts that
              hold the access.{' '}
              <button type="button" className="linkish" onClick={() => goTo('web', pathTarget)}>
                Show the group on the canvas
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
