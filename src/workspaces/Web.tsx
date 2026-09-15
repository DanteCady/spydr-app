import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { useEffect, useRef, useState } from 'react'
import type { DirectorySnapshot } from '@shared/types'
import { buildMembershipGraph, findGroupCycles, groupIdSet, hopNeighborhood, nestedMembership } from '@shared/graph'
import { FindingCard } from '../components/FindingCard'
import { webNodeIcon } from '../components/TypeGlyph'
import { useApp } from '../state'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])

type Density = 'compact' | 'spread'
type WebScope = 'forest' | 'around' | 'nested'

const SEPARATION: Record<Density, number> = {
  compact: 64,
  spread: 112
}

const EDGE_LENGTH: Record<Density, number> = {
  compact: 72,
  spread: 118
}

const REPULSION: Record<Density, number> = {
  compact: 5500,
  spread: 9000
}

const GRID_STEP = 28
const ZOOM_MIN = 0.2
const ZOOM_MAX = 4
const ZOOM_STEP = 1.28

const WEB_STYLE: cytoscape.StylesheetJson = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      color: '#e7ebf1',
      'font-size': 10,
      'font-family': 'Segoe UI, system-ui, sans-serif',
      'text-valign': 'bottom',
      'text-margin-y': 5,
      'background-image': 'data(icon)',
      'background-fit': 'contain',
      'background-clip': 'node',
      'background-width': '70%',
      'background-height': '70%',
      'border-width': 1.5,
      'border-color': '#8d95a3',
      width: 34,
      height: 34
    }
  },
  {
    selector: 'node[kind = "group"]',
    style: {
      'background-color': '#8a7038',
      'border-color': '#c9a35a',
      width: 38,
      height: 38
    }
  },
  {
    selector: 'node[privileged = 1]',
    style: { 'border-color': '#d36b6b', 'border-width': 2.5, 'background-color': '#6a3a3a' }
  },
  {
    selector: 'node[cycle = 1]',
    style: { 'border-style': 'dashed', 'border-color': '#d36b6b' }
  },
  {
    selector: 'node[kind = "user"]',
    style: { 'background-color': '#3d6484', 'border-color': '#8eb4d4' }
  },
  {
    selector: 'node:selected',
    style: { 'border-color': '#7aa2d4', 'border-width': 2.5 }
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

function visibleNodeIds(
  snapshot: DirectorySnapshot,
  graph: ReturnType<typeof buildMembershipGraph>,
  selectedId: string | null,
  userQuery: string,
  scope: WebScope,
  groupsOnly: boolean
): Set<string> {
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]))
  const groups = groupIdSet(snapshot.nodes)
  const selected = selectedId ? byId.get(selectedId) ?? null : null
  const focused = Boolean(scope !== 'forest' && selected && graph.hasNode(selected.id))

  let visible: Set<string>
  if (focused && selected && scope === 'around') {
    visible = hopNeighborhood(graph, selected.id)
  } else if (focused && selected && scope === 'nested') {
    visible = nestedMembership(graph, selected.id)
  } else {
    visible = new Set(groups)
    if (selected?.type === 'user') visible.add(selected.id)
    if (selected?.type === 'group' && !groupsOnly) {
      for (const e of snapshot.edges) {
        if (e.to !== selected.id) continue
        const member = byId.get(e.from)
        if (member?.type === 'user') visible.add(member.id)
      }
    }
  }

  if (groupsOnly) {
    for (const id of [...visible]) {
      if (byId.get(id)?.type === 'user' && id !== selectedId) visible.delete(id)
    }
  }

  const q = userQuery.trim().toLowerCase()
  if (q) {
    for (const n of snapshot.nodes) {
      if (n.type !== 'user') continue
      const hay = `${n.displayName} ${n.sAMAccountName} ${n.userPrincipalName ?? ''}`.toLowerCase()
      if (!hay.includes(q)) continue
      visible.add(n.id)
      if (!graph.hasNode(n.id)) continue
      if (scope === 'around') {
        for (const id of hopNeighborhood(graph, n.id)) visible.add(id)
      }
      if (scope === 'nested') {
        for (const id of nestedMembership(graph, n.id)) visible.add(id)
      }
    }
  }

  for (const id of [...visible]) {
    const type = byId.get(id)?.type
    if (type !== 'user' && type !== 'group') visible.delete(id)
  }
  return visible
}

function nestingConstraints(cy: cytoscape.Core, gap: number): { top: string; bottom: string; gap: number }[] {
  const constraints: { top: string; bottom: string; gap: number }[] = []
  cy.edges().forEach((edge) => {
    const member = edge.source()
    const group = edge.target()
    if (member.data('kind') !== 'group' || group.data('kind') !== 'group') return
    if (member.data('cycle') === 1 && group.data('cycle') === 1) return
    constraints.push({ top: group.id(), bottom: member.id(), gap })
  })
  return constraints
}

function runOrganize(cy: cytoscape.Core, density: Density): void {
  const gap = SEPARATION[density]
  cy.layout({
    name: 'fcose',
    animate: false,
    randomize: true,
    quality: 'proof',
    nodeSeparation: gap,
    nodeDimensionsIncludeLabels: true,
    packComponents: true,
    tile: true,
    tilingPaddingVertical: gap / 2,
    tilingPaddingHorizontal: gap / 2,
    nodeRepulsion: () => REPULSION[density],
    idealEdgeLength: () => EDGE_LENGTH[density],
    edgeElasticity: () => 0.45,
    gravity: 0.35,
    gravityRange: 2.8,
    numIter: 2500,
    relativePlacementConstraint: nestingConstraints(cy, gap),
    fit: true,
    padding: 36
  } as cytoscape.LayoutOptions).run()
}

function zoomBy(cy: cytoscape.Core, factor: number): void {
  const container = cy.container()
  if (!container) return
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cy.zoom() * factor))
  cy.zoom({
    level: next,
    renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 }
  })
}

function syncGrid(cy: cytoscape.Core, el: HTMLElement | null): void {
  if (!el) return
  const size = GRID_STEP * cy.zoom()
  const pan = cy.pan()
  el.style.backgroundSize = `${size}px ${size}px`
  el.style.backgroundPosition = `${pan.x}px ${pan.y}px`
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
  const { snapshot, selectedId, select, activeFinding, clearFinding } = useApp()
  const host = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const selectRef = useRef(select)
  const densityRef = useRef<Density>('spread')
  const laidOut = useRef(false)
  const pendingOrganize = useRef(false)
  const [userQuery, setUserQuery] = useState('')
  const [density, setDensity] = useState<Density>('spread')
  const [grid, setGrid] = useState(true)
  const [scope, setScope] = useState<WebScope>('forest')
  const [groupsOnly, setGroupsOnly] = useState(false)

  selectRef.current = select
  densityRef.current = density

  useEffect(() => {
    if (
      activeFinding &&
      (activeFinding.type === 'circular-nesting' ||
        activeFinding.type === 'deep-nesting' ||
        activeFinding.type === 'distribution-in-security')
    ) {
      setScope('nested')
    }
  }, [activeFinding])

  useEffect(() => {
    if (!host.current || !snapshot) return

    const cy = cytoscape({
      container: host.current,
      elements: [],
      wheelSensitivity: 0.3,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      pixelRatio: 2,
      style: WEB_STYLE,
      layout: { name: 'preset' }
    })
    cy.on('tap', 'node', (ev) => selectRef.current(ev.target.id()))
    cy.on('tap', (ev) => {
      if (ev.target === cy) selectRef.current(null)
    })
    const onViewport = (): void => syncGrid(cy, wrap.current)
    cy.on('viewport', onViewport)
    cyRef.current = cy
    laidOut.current = false
    syncGrid(cy, wrap.current)
    return () => {
      cy.off('viewport', onViewport)
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
    const visible = visibleNodeIds(snapshot, graph, selectedId, userQuery, scope, groupsOnly)
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
          cycle: cycles.has(n.id) ? 1 : 0,
          icon: webNodeIcon(n.type)
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

    if (added.length && laidOut.current && scope === 'forest') {
      placeAround(cy, added, selectedId)
    }

    if (!laidOut.current || pendingOrganize.current || scope !== 'forest') {
      pendingOrganize.current = false
      laidOut.current = true
      runOrganize(cy, densityRef.current)
    }
  }, [snapshot, selectedId, userQuery, scope, groupsOnly])

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

  useEffect(() => {
    const cy = cyRef.current
    if (cy) syncGrid(cy, wrap.current)
  }, [grid])

  if (!snapshot) return null

  const selected = snapshot.nodes.find((n) => n.id === selectedId)
  const focused = scope !== 'forest' && selected && (selected.type === 'user' || selected.type === 'group')
  const hint = !focused
    ? scope === 'around'
      ? 'Select a user or group to see direct membership'
      : scope === 'nested'
        ? 'Select a user or group to see nested membership'
        : selected?.type === 'group'
          ? `Showing members of ${selected.displayName}`
          : selected?.type === 'user'
            ? `Showing ${selected.displayName} and groups`
            : 'Select a group to expand its users'
    : scope === 'around' && selected.type === 'user'
      ? `Direct groups for ${selected.displayName}`
      : scope === 'around'
        ? `Direct members and parent groups of ${selected.displayName}`
        : selected.type === 'user'
          ? `Groups ${selected.displayName} nests into`
          : `Nested members and parent groups of ${selected.displayName}`

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
    setScope('forest')
    setGroupsOnly(false)
    setUserQuery('')
    select(null)
    if (!userQuery && !selectedId && scope === 'forest' && !groupsOnly) {
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
        <div className="web-tools" role="toolbar" aria-label="Membership scope">
          <button type="button" className={scope === 'forest' ? 'active' : ''} aria-pressed={scope === 'forest'} onClick={() => setScope('forest')}>
            Forest
          </button>
          <button type="button" className={scope === 'around' ? 'active' : ''} aria-pressed={scope === 'around'} onClick={() => setScope('around')}>
            Around
          </button>
          <button type="button" className={scope === 'nested' ? 'active' : ''} aria-pressed={scope === 'nested'} onClick={() => setScope('nested')}>
            Nested
          </button>
          <button type="button" className={groupsOnly ? 'active' : ''} aria-pressed={groupsOnly} onClick={() => setGroupsOnly((on) => !on)}>
            Groups only
          </button>
        </div>
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
          <span className="web-tools-sep" aria-hidden />
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => cyRef.current && zoomBy(cyRef.current, 1 / ZOOM_STEP)}>
            −
          </button>
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => cyRef.current && zoomBy(cyRef.current, ZOOM_STEP)}>
            +
          </button>
          <button type="button" onClick={() => cyRef.current?.fit(undefined, 36)}>
            Fit
          </button>
          <span className="web-tools-sep" aria-hidden />
          <button type="button" className={grid ? 'active' : ''} aria-pressed={grid} onClick={() => setGrid((on) => !on)}>
            Grid
          </button>
          <button type="button" onClick={resetView}>
            Reset
          </button>
        </div>
        <span className="muted">Gold = group · blue = user · red = privileged · dashed = cycle · layout stays put until Organize</span>
      </div>
      {activeFinding && (activeFinding.type === 'circular-nesting' || activeFinding.type === 'deep-nesting' || activeFinding.type === 'distribution-in-security') ? (
        <FindingCard finding={activeFinding} onDismiss={clearFinding} />
      ) : null}
      <div className={grid ? 'web-wrap has-grid' : 'web-wrap'} ref={wrap}>
        <div className="web-canvas" ref={host} />
      </div>
    </div>
  )
}
