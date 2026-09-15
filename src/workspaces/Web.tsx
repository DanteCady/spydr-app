import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { useEffect, useRef, useState } from 'react'
import type { DirectorySnapshot } from '@shared/types'
import { buildMembershipGraph, findGroupCycles, groupIdSet } from '@shared/graph'
import { useApp } from '../state'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])

type Density = 'compact' | 'spread'

const SEPARATION: Record<Density, number> = {
  compact: 56,
  spread: 110
}

const WEB_STYLE: cytoscape.StylesheetJson = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      color: '#e7ebf1',
      'font-size': 10,
      'font-family': 'Segoe UI, system-ui, sans-serif',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'background-color': '#1c222b',
      'border-width': 1.5,
      'border-color': '#8d95a3',
      width: 18,
      height: 18
    }
  },
  {
    selector: 'node[kind = "group"]',
    style: { 'border-color': '#c9a35a', 'background-color': '#2a2418', width: 22, height: 22 }
  },
  {
    selector: 'node[privileged = 1]',
    style: { 'border-color': '#d36b6b', 'border-width': 2.5 }
  },
  {
    selector: 'node[cycle = 1]',
    style: { 'border-style': 'dashed', 'border-color': '#d36b6b' }
  },
  {
    selector: 'node[kind = "user"]',
    style: { 'border-color': '#8eb4d4', 'background-color': '#18222c' }
  },
  {
    selector: 'node:selected',
    style: { 'background-color': '#24364d', 'border-color': '#7aa2d4' }
  },
  {
    selector: 'edge',
    style: {
      width: 1,
      'line-color': '#3a4250',
      'target-arrow-color': '#3a4250',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.7,
      'curve-style': 'bezier'
    }
  }
]

function visibleNodeIds(snapshot: DirectorySnapshot, selectedId: string | null, userQuery: string): Set<string> {
  const visible = new Set(snapshot.nodes.filter((n) => n.type === 'group').map((n) => n.id))
  const selected = snapshot.nodes.find((n) => n.id === selectedId)
  if (selected?.type === 'group') {
    for (const e of snapshot.edges) {
      if (e.to !== selected.id) continue
      const member = snapshot.nodes.find((n) => n.id === e.from)
      if (member?.type === 'user') visible.add(member.id)
    }
  }
  if (selected?.type === 'user') visible.add(selected.id)
  const q = userQuery.trim().toLowerCase()
  if (q) {
    for (const n of snapshot.nodes) {
      if (n.type !== 'user') continue
      const hay = `${n.displayName} ${n.sAMAccountName} ${n.userPrincipalName ?? ''}`.toLowerCase()
      if (hay.includes(q)) visible.add(n.id)
    }
  }
  return visible
}

function runOrganize(cy: cytoscape.Core, density: Density): void {
  cy.layout({
    name: 'fcose',
    animate: false,
    randomize: false,
    quality: 'proof',
    nodeSeparation: SEPARATION[density],
    fit: true,
    padding: 36
  } as cytoscape.LayoutOptions).run()
}

function placeAround(cy: cytoscape.Core, ids: string[], anchorId: string | null): void {
  const anchorNode = anchorId ? cy.$id(anchorId) : cy.collection()
  const origin = anchorNode.nonempty()
    ? anchorNode.position()
    : (() => {
        const ext = cy.extent()
        return { x: (ext.x1 + ext.x2) / 2, y: (ext.y1 + ext.y2) / 2 }
      })()
  ids.forEach((id, i) => {
    const ring = Math.floor(i / 8)
    const slot = i % 8
    const inRing = Math.min(8, ids.length - ring * 8)
    const angle = (slot / inRing) * Math.PI * 2 - Math.PI / 2
    const r = 52 + ring * 28
    cy.$id(id).position({
      x: origin.x + Math.cos(angle) * r,
      y: origin.y + Math.sin(angle) * r
    })
  })
}

export function Web() {
  const { snapshot, selectedId, select, activeFinding } = useApp()
  const host = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const selectRef = useRef(select)
  const densityRef = useRef<Density>('spread')
  const laidOut = useRef(false)
  const pendingOrganize = useRef(false)
  const [userQuery, setUserQuery] = useState('')
  const [density, setDensity] = useState<Density>('spread')

  selectRef.current = select
  densityRef.current = density

  useEffect(() => {
    if (!host.current || !snapshot) return

    const cy = cytoscape({
      container: host.current,
      elements: [],
      wheelSensitivity: 0.3,
      style: WEB_STYLE,
      layout: { name: 'preset' }
    })
    cy.on('tap', 'node', (ev) => selectRef.current(ev.target.id()))
    cy.on('tap', (ev) => {
      if (ev.target === cy) selectRef.current(null)
    })
    cyRef.current = cy
    laidOut.current = false
    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [snapshot])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !snapshot) return

    const groups = groupIdSet(snapshot.nodes)
    const graph = buildMembershipGraph(snapshot.nodes, snapshot.edges)
    const cycles = new Set(findGroupCycles(graph, groups).flat())
    const visible = visibleNodeIds(snapshot, selectedId, userQuery)
    const byId = new Map(snapshot.nodes.map((n) => [n.id, n]))

    cy.nodes().filter((node) => !visible.has(node.id())).remove()
    cy.edges().filter((edge) => !visible.has(edge.source().id()) || !visible.has(edge.target().id())).remove()

    const added: string[] = []
    for (const id of visible) {
      const n = byId.get(id)
      if (!n || cy.$id(id).nonempty()) continue
      cy.add({
        data: {
          id: n.id,
          label: n.displayName,
          kind: n.type,
          privileged: n.privileged ? 1 : 0,
          cycle: cycles.has(n.id) ? 1 : 0
        }
      })
      added.push(id)
    }
    for (const e of snapshot.edges) {
      if (!visible.has(e.from) || !visible.has(e.to)) continue
      const eid = `${e.from}->${e.to}`
      if (cy.$id(eid).nonempty()) continue
      cy.add({ data: { id: eid, source: e.from, target: e.to } })
    }

    if (added.length && laidOut.current) {
      placeAround(cy, added, selectedId)
    }

    if (!laidOut.current || pendingOrganize.current) {
      pendingOrganize.current = false
      laidOut.current = true
      runOrganize(cy, densityRef.current)
    }
  }, [snapshot, selectedId, userQuery])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().unselect()
    if (selectedId && cy.$id(selectedId).nonempty()) {
      const node = cy.$id(selectedId)
      node.select()
      cy.animate({ center: { eles: node }, duration: 180 })
    }
  }, [selectedId])

  if (!snapshot) return null

  const selected = snapshot.nodes.find((n) => n.id === selectedId)
  const hint =
    selected?.type === 'group'
      ? `Showing members of ${selected.displayName}`
      : selected?.type === 'user'
        ? `Showing ${selected.displayName} and groups`
        : 'Select a group to expand its users'

  const organizeNow = (next?: Density): void => {
    if (next) {
      densityRef.current = next
      setDensity(next)
    }
    const cy = cyRef.current
    if (cy) runOrganize(cy, next ?? densityRef.current)
  }

  const resetView = (): void => {
    pendingOrganize.current = true
    setUserQuery('')
    select(null)
    if (!userQuery && !selectedId) {
      pendingOrganize.current = false
      const cy = cyRef.current
      if (cy) runOrganize(cy, densityRef.current)
    }
  }

  return (
    <div className="split-list">
      <div className="toolbar web-toolbar">
        <span className="muted">{hint}</span>
        <input
          type="search"
          placeholder="Search users onto the web…"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
        />
        <div className="web-tools" role="toolbar" aria-label="Canvas layout">
          <button type="button" onClick={() => organizeNow()}>
            Organize
          </button>
          <button
            type="button"
            className={density === 'compact' ? 'active' : ''}
            aria-pressed={density === 'compact'}
            onClick={() => organizeNow('compact')}
          >
            Compact
          </button>
          <button
            type="button"
            className={density === 'spread' ? 'active' : ''}
            aria-pressed={density === 'spread'}
            onClick={() => organizeNow('spread')}
          >
            Spread
          </button>
          <button type="button" onClick={() => cyRef.current?.fit(undefined, 36)}>
            Fit
          </button>
          <button type="button" onClick={resetView}>
            Reset
          </button>
        </div>
        <span className="muted">Gold = group · red ring = privileged · dashed = cycle · layout stays put until Organize</span>
      </div>
      {activeFinding && (activeFinding.type === 'circular-nesting' || activeFinding.type === 'deep-nesting' || activeFinding.type === 'distribution-in-security') ? (
        <div className="path-card" style={{ margin: '8px 12px 0' }}>
          <span className={`badge ${activeFinding.severity}`}>{activeFinding.severity}</span> {activeFinding.title}
          <p>{activeFinding.detail}</p>
          <p className="suggested">{activeFinding.suggestedFix}</p>
        </div>
      ) : null}
      <div className="web-wrap">
        <div className="web-canvas" ref={host} />
      </div>
    </div>
  )
}
