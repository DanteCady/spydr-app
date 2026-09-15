import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirectorySnapshot } from '@shared/types'
import { buildMembershipGraph, findGroupCycles, groupIdSet, hopNeighborhood, nestedMembership } from '@shared/graph'
import { FindingCard } from '../components/FindingCard'
import { StatusBadges } from '../components/StatusBadges'
import { TypeGlyph, webNodeIcon } from '../components/TypeGlyph'
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
      color: '#c9d2de',
      'font-size': 9.5,
      'font-family': 'Segoe UI, system-ui, sans-serif',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      'text-wrap': 'ellipsis',
      'text-max-width': '110px',
      'text-background-color': '#0c0e12',
      'text-background-opacity': 0.8,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      'min-zoomed-font-size': 8,
      'background-image': 'data(icon)',
      'background-fit': 'contain',
      'background-clip': 'node',
      'background-width': '62%',
      'background-height': '62%',
      'border-width': 1.5,
      'border-color': '#8d95a3',
      'transition-property': 'opacity',
      'transition-duration': 120,
      width: 30,
      height: 30
    }
  },
  {
    selector: 'node[kind = "group"]',
    style: {
      'background-color': '#7d6633',
      'border-color': '#c9a35a',
      width: 38,
      height: 38
    }
  },
  {
    selector: 'node[kind = "user"]',
    style: { 'background-color': '#38597a', 'border-color': '#8eb4d4' }
  },
  {
    selector: 'node[privileged = 1]',
    style: {
      'border-color': '#d36b6b',
      'border-width': 2,
      'background-color': '#63393c',
      'underlay-color': '#d36b6b',
      'underlay-opacity': 0.14,
      'underlay-padding': 6,
      'underlay-shape': 'ellipse'
    }
  },
  {
    selector: 'node[cycle = 1]',
    style: { 'border-style': 'dashed', 'border-color': '#d36b6b' }
  },
  {
    selector: 'node:selected',
    style: {
      'border-color': '#7aa2d4',
      'border-width': 2.5,
      'underlay-color': '#7aa2d4',
      'underlay-opacity': 0.18,
      'underlay-padding': 8,
      'underlay-shape': 'ellipse'
    }
  },
  {
    selector: 'edge',
    style: {
      width: 1.2,
      'line-color': '#414b5c',
      'target-arrow-color': '#414b5c',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.75,
      'curve-style': 'bezier',
      'transition-property': 'opacity',
      'transition-duration': 120
    }
  },
  {
    selector: 'edge.hover, edge.sel',
    style: {
      width: 2,
      'line-color': '#7aa2d4',
      'target-arrow-color': '#7aa2d4'
    }
  },
  {
    selector: 'node.faded',
    style: { opacity: 0.18, 'text-opacity': 0 }
  },
  {
    selector: 'edge.faded',
    style: { opacity: 0.1 }
  }
]

function applyFocus(cy: cytoscape.Core, selectedId: string | null): void {
  cy.elements().removeClass('faded')
  if (!selectedId || cy.$id(selectedId).empty()) return
  const hood = cy.$id(selectedId).closedNeighborhood()
  cy.elements().difference(hood).addClass('faded')
}

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
  const [shown, setShown] = useState({ nodes: 0, edges: 0 })
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null)
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
    cy.on('mouseover', 'node', (ev) => {
      ev.target.connectedEdges().addClass('hover')
      const p = ev.target.renderedPosition()
      setTip({ id: ev.target.id(), x: p.x, y: p.y })
    })
    cy.on('mouseout', 'node', (ev) => {
      ev.target.connectedEdges().removeClass('hover')
      setTip(null)
    })
    cy.on('grab', 'node', () => setTip(null))
    const onViewport = (): void => {
      syncGrid(cy, wrap.current)
      setTip(null)
    }
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

    cy.edges().removeClass('sel')
    if (selectedId && cy.$id(selectedId).nonempty()) {
      cy.$id(selectedId).connectedEdges().addClass('sel')
    }
    applyFocus(cy, selectedId)
    setShown({ nodes: cy.nodes().length, edges: cy.edges().length })

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
    cy.edges().removeClass('sel')
    if (selectedId && cy.$id(selectedId).nonempty()) {
      const node = cy.$id(selectedId)
      node.select()
      node.connectedEdges().addClass('sel')
      cy.animate({ center: { eles: node }, duration: 180 })
    }
    applyFocus(cy, selectedId)
  }, [selectedId])

  useEffect(() => {
    const cy = cyRef.current
    if (cy) syncGrid(cy, wrap.current)
  }, [grid])

  const memberCounts = useMemo(() => {
    const members = new Map<string, number>()
    const memberOf = new Map<string, number>()
    for (const e of snapshot?.edges ?? []) {
      members.set(e.to, (members.get(e.to) ?? 0) + 1)
      memberOf.set(e.from, (memberOf.get(e.from) ?? 0) + 1)
    }
    return { members, memberOf }
  }, [snapshot])

  if (!snapshot) return null

  const tipNode = tip ? snapshot.nodes.find((n) => n.id === tip.id) : null
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
        <div className="seg" role="toolbar" aria-label="Membership scope">
          <button type="button" className={scope === 'forest' ? 'active' : ''} aria-pressed={scope === 'forest'} onClick={() => setScope('forest')}>
            Forest
          </button>
          <button type="button" className={scope === 'around' ? 'active' : ''} aria-pressed={scope === 'around'} onClick={() => setScope('around')}>
            Around
          </button>
          <button type="button" className={scope === 'nested' ? 'active' : ''} aria-pressed={scope === 'nested'} onClick={() => setScope('nested')}>
            Nested
          </button>
        </div>
        <button type="button" className={groupsOnly ? 'chip active' : 'chip'} aria-pressed={groupsOnly} onClick={() => setGroupsOnly((on) => !on)}>
          Groups only
        </button>
        <input
          type="search"
          placeholder="Search users onto the web…"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
        />
        <span className="spacer" />
        <div className="seg" role="toolbar" aria-label="Layout density">
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
        </div>
        <div className="seg" role="toolbar" aria-label="Canvas">
          <button type="button" onClick={() => organizeNow()}>
            Organize
          </button>
          <button type="button" className={grid ? 'active' : ''} aria-pressed={grid} onClick={() => setGrid((on) => !on)}>
            Grid
          </button>
          <button type="button" onClick={resetView}>
            Reset
          </button>
        </div>
      </div>
      <div className={grid ? 'web-wrap has-grid' : 'web-wrap'} ref={wrap}>
        <div className="web-canvas" ref={host} />
        <div className="web-status" aria-live="polite">
          <span>{hint}</span>
          <span className="web-status-counts">
            {shown.nodes} node{shown.nodes === 1 ? '' : 's'} · {shown.edges} edge{shown.edges === 1 ? '' : 's'}
          </span>
        </div>
        {activeFinding && (activeFinding.type === 'circular-nesting' || activeFinding.type === 'deep-nesting' || activeFinding.type === 'distribution-in-security') ? (
          <div className="web-finding">
            <FindingCard finding={activeFinding} onDismiss={clearFinding} />
          </div>
        ) : null}
        {tip && tipNode ? (
          <div
            className={tip.y < 150 ? 'web-tip below' : 'web-tip'}
            style={{ left: tip.x, top: tip.y }}
            role="tooltip"
          >
            <div className="web-tip-head">
              <TypeGlyph type={tipNode.type} />
              <strong>{tipNode.displayName}</strong>
            </div>
            <div className="web-tip-sub">
              {tipNode.sAMAccountName}
              {tipNode.type === 'group'
                ? ` · ${memberCounts.members.get(tipNode.id) ?? 0} member${(memberCounts.members.get(tipNode.id) ?? 0) === 1 ? '' : 's'}`
                : ''}
              {` · in ${memberCounts.memberOf.get(tipNode.id) ?? 0} group${(memberCounts.memberOf.get(tipNode.id) ?? 0) === 1 ? '' : 's'}`}
            </div>
            {tipNode.description ? <div className="web-tip-desc">{tipNode.description}</div> : null}
            <StatusBadges node={tipNode} />
          </div>
        ) : null}
        <div className="web-legend" aria-hidden>
          <span className="legend-row">
            <span className="legend-dot user" /> User
          </span>
          <span className="legend-row">
            <span className="legend-dot group" /> Group
          </span>
          <span className="legend-row">
            <span className="legend-dot privileged" /> Privileged
          </span>
          <span className="legend-row">
            <span className="legend-dot cycle" /> In a cycle
          </span>
        </div>
        <div className="web-controls">
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => cyRef.current && zoomBy(cyRef.current, ZOOM_STEP)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => cyRef.current && zoomBy(cyRef.current, 1 / ZOOM_STEP)}>
            −
          </button>
          <button type="button" aria-label="Fit to view" title="Fit to view" onClick={() => cyRef.current?.fit(undefined, 36)}>
            Fit
          </button>
        </div>
      </div>
    </div>
  )
}
