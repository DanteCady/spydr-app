import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import fcose from 'cytoscape-fcose'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirectoryObjectType, DirectorySnapshot } from '@shared/types'
import { buildMembershipGraph, findGroupCycles, groupIdSet, hopNeighborhood, nestedMembership } from '@shared/graph'
import { FindingCard } from '../components/FindingCard'
import { StatusBadges } from '../components/StatusBadges'
import { TypeGlyph, webNodeIcon } from '../components/TypeGlyph'
import { WebMinimap } from '../components/WebMinimap'
import { useApp } from '../state'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])
cytoscape.use(dagre as Parameters<typeof cytoscape.use>[0])

type Density = 'compact' | 'spread'
type WebScope = 'forest' | 'around' | 'nested'
type LayoutMode = 'tree' | 'web'

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
const LOD_THRESHOLD = 250

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function typeIconColor(type: string): string {
  return cssVar(type === 'user' ? '--user' : type === 'group' ? '--group' : '--computer')
}

function buildWebStyle(mode: LayoutMode): cytoscape.StylesheetJson {
  const text = cssVar('--foreground')
  const canvas = cssVar('--canvas')
  const brand = cssVar('--brand')
  const crit = cssVar('--crit')
  const border = cssVar('--border')
  const member = cssVar('--edge-member')
  const primary = cssVar('--edge-primary')
  // Tree mode routes edges as orthogonal org-chart connectors flowing upward;
  // organic mode keeps soft bezier curves.
  const edgeCurve = mode === 'tree'
    ? { 'curve-style': 'taxi', 'taxi-direction': 'upward', 'taxi-turn': '40%', 'taxi-turn-min-distance': '8px' }
    : { 'curve-style': 'bezier' }
  return [
    // arcelyt card nodes: neutral rounded-rect, name inside, colored type glyph at left
    {
      selector: 'node',
      style: {
        shape: 'round-rectangle',
        'corner-radius': '8px',
        'background-color': cssVar('--graph-node-bg'),
        'border-width': 1,
        'border-color': border,
        label: 'data(label)',
        color: text,
        'font-size': 11,
        'font-weight': 500,
        'font-family': 'IBM Plex Sans, system-ui, sans-serif',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'ellipsis',
        'text-max-width': '140px',
        'text-margin-x': 10,
        'min-zoomed-font-size': 7,
        'background-image': 'data(icon)',
        'background-fit': 'none',
        'background-width': '13px',
        'background-height': '13px',
        'background-position-x': '7px',
        'background-position-y': '50%',
        'transition-property': 'opacity',
        'transition-duration': 120,
        width: 'label',
        height: 30,
        padding: '9px'
      }
    },
    {
      selector: 'node[kind = "group"]',
      style: { 'font-weight': 600 }
    },
    {
      selector: 'node[privileged = 1]',
      style: {
        'border-color': crit,
        'border-width': 1.5,
        'underlay-color': crit,
        'underlay-opacity': 0.12,
        'underlay-padding': 4
      }
    },
    {
      selector: 'node[cycle = 1]',
      style: { 'border-style': 'dashed', 'border-color': crit }
    },
    {
      selector: 'node[kind = "cluster"]',
      style: {
        'background-color': cssVar('--web-cluster-bg'),
        'border-color': cssVar('--ou'),
        'border-width': 1.5,
        'background-image': 'none',
        'text-margin-x': 0,
        'font-size': 10.5,
        height: 28
      }
    },
    // focus treatment: brand border + soft brand ring, focus surface
    {
      selector: 'node:selected',
      style: {
        'background-color': cssVar('--graph-focus-bg'),
        'border-color': brand,
        'border-width': 2,
        'underlay-color': brand,
        'underlay-opacity': 0.22,
        'underlay-padding': 5
      }
    },
    // arcelyt relationship edges: colored solid lines, labels revealed on hover/select
    {
      selector: 'edge',
      style: {
        width: 'mapData(w, 1, 10, 1.6, 4)',
        ...edgeCurve,
        'line-color': member,
        'target-arrow-color': member,
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1,
        opacity: 0.92,
        label: 'data(rel)',
        'font-size': 8,
        'font-family': 'IBM Plex Mono, ui-monospace, monospace',
        color: member,
        'text-opacity': 0,
        'text-rotation': mode === 'tree' ? 'none' : 'autorotate',
        'text-background-color': canvas,
        'text-background-opacity': 0.9,
        'text-background-padding': '2px',
        'transition-property': 'opacity',
        'transition-duration': 120
      }
    },
    // primary-group membership is implicit — dashed amber, arcelyt's "inferred" signal
    {
      selector: 'edge[via = "primaryGroup"]',
      style: {
        'line-style': 'dashed',
        'line-dash-pattern': [6, 4],
        'line-color': primary,
        'target-arrow-color': primary,
        color: primary
      }
    },
    {
      selector: 'edge.cyc',
      style: {
        'line-style': 'dashed',
        'line-dash-pattern': [5, 4],
        'line-color': crit,
        'target-arrow-color': crit,
        color: crit
      }
    },
    {
      selector: 'edge.hover, edge.sel',
      style: {
        width: 3.2,
        'line-color': brand,
        'target-arrow-color': brand,
        color: brand,
        'text-opacity': 1,
        opacity: 1
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
}

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

interface WebNodeDef {
  id: string
  label: string
  kind: string
  privileged: number
  cycle: number
  icon?: string
  dn?: string
}

interface WebEdgeDef {
  id: string
  source: string
  target: string
  w: number
  via: string
  rel: string
}

function buildWebElements(
  snapshot: DirectorySnapshot,
  visible: Set<string>,
  cycles: Set<string>,
  expanded: Set<string>,
  selectedId: string | null
): { nodes: WebNodeDef[]; edges: WebEdgeDef[]; clusters: number; collapsed: number } {
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]))
  const byDn = new Map(snapshot.nodes.map((n) => [n.dn, n]))
  const clustered = visible.size > LOD_THRESHOLD
  const effExpanded = new Set(expanded)
  const sel = selectedId ? byId.get(selectedId) : null
  if (sel?.type === 'group' && sel.parentDn) effExpanded.add(sel.parentDn)

  const mapId = (id: string): string => {
    if (!clustered) return id
    const n = byId.get(id)
    if (n?.type === 'group' && n.parentDn && !effExpanded.has(n.parentDn)) return `ou:${n.parentDn}`
    return id
  }

  const nodes = new Map<string, WebNodeDef>()
  const counts = new Map<string, number>()
  for (const id of visible) {
    const n = byId.get(id)
    if (!n) continue
    const mapped = mapId(id)
    if (mapped !== id) {
      counts.set(mapped, (counts.get(mapped) ?? 0) + 1)
      if (!nodes.has(mapped)) {
        const parent = n.parentDn ? byDn.get(n.parentDn) : undefined
        const name = parent?.displayName ?? n.parentDn?.split(',')[0]?.replace(/^(OU|CN)=/i, '') ?? 'OU'
        nodes.set(mapped, { id: mapped, label: name, kind: 'cluster', privileged: 0, cycle: 0, dn: n.parentDn ?? '' })
      }
    } else if (!nodes.has(id)) {
      nodes.set(id, {
        id: n.id,
        label: n.displayName,
        kind: n.type,
        privileged: n.privileged ? 1 : 0,
        cycle: cycles.has(n.id) ? 1 : 0,
        icon: webNodeIcon(n.type, typeIconColor(n.type))
      })
    }
  }
  for (const [cid, c] of counts) {
    const def = nodes.get(cid)
    if (def) def.label = `${def.label} · ${c}`
  }

  const edges = new Map<string, WebEdgeDef>()
  for (const e of snapshot.edges) {
    if (!visible.has(e.from) || !visible.has(e.to)) continue
    const s = mapId(e.from)
    const t = mapId(e.to)
    if (s === t) continue
    const eid = `${s}->${t}`
    const cur = edges.get(eid)
    if (cur) {
      cur.w = Math.min(10, cur.w + 1)
      cur.rel = `${cur.w} memberships`
    } else {
      edges.set(eid, {
        id: eid,
        source: s,
        target: t,
        w: 1,
        via: e.via,
        rel: e.via === 'primaryGroup' ? 'primary group' : 'member of'
      })
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    clusters: counts.size,
    collapsed: [...counts.values()].reduce((a, b) => a + b, 0)
  }
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

const RANK_SEP: Record<Density, number> = { compact: 58, spread: 92 }
const NODE_SEP: Record<Density, number> = { compact: 16, spread: 32 }

function runTree(cy: cytoscape.Core, density: Density): void {
  cy.layout({
    name: 'dagre',
    // Edges run member -> group; BT ranks members low and the groups they nest
    // into progressively higher, so privileged targets land at the top.
    rankDir: 'BT',
    ranker: 'network-simplex',
    nodeSep: NODE_SEP[density],
    rankSep: RANK_SEP[density],
    edgeSep: 12,
    animate: false,
    fit: true,
    padding: 40
  } as cytoscape.LayoutOptions).run()
}

function runLayout(cy: cytoscape.Core, mode: LayoutMode, density: Density): void {
  if (mode === 'tree') runTree(cy, density)
  else runOrganize(cy, density)
}

function orderedNodeIds(cy: cytoscape.Core): string[] {
  return cy
    .nodes()
    .toArray()
    .filter((n) => n.data('kind') !== 'cluster')
    .map((n) => ({ id: n.id(), p: n.position() }))
    .sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x)
    .map((n) => n.id)
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

function placeAround(cy: cytoscape.Core, ids: string[], anchorId: string | null, at?: { x: number; y: number }): void {
  const anchorNode = anchorId ? cy.$id(anchorId) : cy.collection()
  const origin =
    at ??
    (anchorNode.nonempty()
      ? anchorNode.position()
      : (() => {
          const ext = cy.extent()
          return { x: (ext.x1 + ext.x2) / 2, y: (ext.y1 + ext.y2) / 2 }
        })())
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
  const { snapshot, selectedId, select, activeFinding, clearFinding, theme } = useApp()
  const host = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const selectRef = useRef(select)
  const densityRef = useRef<Density>('spread')
  const modeRef = useRef<LayoutMode>('tree')
  const laidOut = useRef(false)
  const pendingOrganize = useRef(false)
  const [userQuery, setUserQuery] = useState('')
  const [shown, setShown] = useState({ nodes: 0, edges: 0, clusters: 0, collapsed: 0 })
  const [expandedOus, setExpandedOus] = useState<Set<string>>(new Set())
  const expandOuRef = useRef<(dn: string) => void>(() => {})
  expandOuRef.current = (dn) => setExpandedOus((s) => new Set(s).add(dn))
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null)
  const [cyInstance, setCyInstance] = useState<cytoscape.Core | null>(null)
  const [density, setDensity] = useState<Density>('spread')
  const [mode, setMode] = useState<LayoutMode>('tree')
  const [grid, setGrid] = useState(false)
  const [scope, setScope] = useState<WebScope>('forest')
  const [groupsOnly, setGroupsOnly] = useState(false)

  selectRef.current = select
  densityRef.current = density
  modeRef.current = mode

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
      style: buildWebStyle(modeRef.current),
      layout: { name: 'preset' }
    })
    cy.on('tap', 'node', (ev) => {
      if (ev.target.data('kind') === 'cluster') expandOuRef.current(ev.target.data('dn') as string)
      else selectRef.current(ev.target.id())
    })
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
    setCyInstance(cy)
    ;(window as { __spydrCy?: cytoscape.Core }).__spydrCy = cy
    laidOut.current = false
    syncGrid(cy, wrap.current)
    return () => {
      cy.off('viewport', onViewport)
      cy.destroy()
      cyRef.current = null
      setCyInstance(null)
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
    const built = buildWebElements(snapshot, visible, cycles, expandedOus, selectedId)
    const nodeIds = new Set(built.nodes.map((n) => n.id))
    const edgeIds = new Set(built.edges.map((e) => e.id))

    const prevPos = new Map<string, { x: number; y: number }>()
    const prevElIds = new Set<string>()
    cy.nodes().forEach((n) => {
      prevPos.set(n.id(), { ...n.position() })
    })
    cy.elements().forEach((el) => {
      prevElIds.add(el.id())
    })
    const structureChanged =
      prevElIds.size !== nodeIds.size + edgeIds.size ||
      [...nodeIds].some((id) => !prevElIds.has(id)) ||
      [...edgeIds].some((id) => !prevElIds.has(id))

    cy.nodes().filter((node) => !nodeIds.has(node.id())).remove()
    cy.edges().filter((edge) => !edgeIds.has(edge.id())).remove()

    const added: string[] = []
    for (const def of built.nodes) {
      const existing = cy.$id(def.id)
      if (existing.nonempty()) {
        if (existing.data('label') !== def.label) existing.data('label', def.label)
        continue
      }
      cy.add({ data: { ...def } })
      added.push(def.id)
    }
    for (const def of built.edges) {
      const existing = cy.$id(def.id)
      if (existing.nonempty()) {
        if (existing.data('rel') !== def.rel) existing.data('rel', def.rel)
        continue
      }
      cy.add({ data: { ...def } })
    }
    cy.edges().forEach((ed) => {
      ed.toggleClass('cyc', ed.source().data('cycle') === 1 && ed.target().data('cycle') === 1)
    })

    cy.edges().removeClass('sel')
    if (selectedId && cy.$id(selectedId).nonempty()) {
      cy.$id(selectedId).connectedEdges().addClass('sel')
    }
    applyFocus(cy, selectedId)
    setShown({ nodes: cy.nodes().length, edges: cy.edges().length, clusters: built.clusters, collapsed: built.collapsed })

    if (modeRef.current === 'tree') {
      // Deterministic hierarchy: relayout only when the element set changes,
      // so merely selecting a node never reshuffles the tree.
      if (!laidOut.current || pendingOrganize.current || structureChanged) {
        pendingOrganize.current = false
        laidOut.current = true
        runTree(cy, densityRef.current)
      }
    } else {
      if (added.length && laidOut.current && scope === 'forest') {
        const byOrigin = new Map<string, string[]>()
        const rest: string[] = []
        for (const id of added) {
          const n = byId.get(id)
          const cid = n?.type === 'group' && n.parentDn ? `ou:${n.parentDn}` : null
          if (cid && prevPos.has(cid)) {
            byOrigin.set(cid, [...(byOrigin.get(cid) ?? []), id])
          } else {
            rest.push(id)
          }
        }
        for (const [cid, ids] of byOrigin) placeAround(cy, ids, null, prevPos.get(cid))
        if (rest.length) placeAround(cy, rest, selectedId)
      }

      if (!laidOut.current || pendingOrganize.current || scope !== 'forest') {
        pendingOrganize.current = false
        laidOut.current = true
        runOrganize(cy, densityRef.current)
      }
    }
  }, [snapshot, selectedId, userQuery, scope, groupsOnly, expandedOus])

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

  useEffect(() => {
    // Defer a frame: the provider's effect that flips data-theme on <html>
    // runs after this child effect, and the palette must be read after it.
    const id = requestAnimationFrame(() => {
      const cy = cyRef.current
      if (!cy || cy.destroyed()) return
      cy.style(buildWebStyle(modeRef.current))
      cy.nodes().forEach((n) => {
        const kind = n.data('kind') as DirectoryObjectType | 'cluster'
        if (kind !== 'cluster') n.data('icon', webNodeIcon(kind, typeIconColor(kind)))
      })
      cy.emit('viewport') // repaint the minimap with the new palette
    })
    return () => cancelAnimationFrame(id)
  }, [theme])

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
    if (cy) runLayout(cy, modeRef.current, next ?? densityRef.current)
  }

  const changeMode = (next: LayoutMode): void => {
    modeRef.current = next
    setMode(next)
    const cy = cyRef.current
    if (!cy) return
    cy.style(buildWebStyle(next))
    runLayout(cy, next, densityRef.current)
  }

  const onCanvasKeys = (ev: React.KeyboardEvent): void => {
    const cy = cyRef.current
    if (!cy) return
    const step = (dir: 1 | -1): void => {
      const ids = orderedNodeIds(cy)
      if (ids.length === 0) return
      const idx = selectedId ? ids.indexOf(selectedId) : -1
      const next = idx === -1 ? (dir === 1 ? ids[0] : ids[ids.length - 1]) : ids[(idx + dir + ids.length) % ids.length]
      select(next)
    }
    switch (ev.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        step(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        step(-1)
        break
      case 'Enter':
        if (selectedId && cy.$id(selectedId).nonempty()) {
          cy.animate({ center: { eles: cy.$id(selectedId) }, duration: 180 })
        }
        break
      case 'Escape':
        select(null)
        break
      case '+':
      case '=':
        zoomBy(cy, ZOOM_STEP)
        break
      case '-':
      case '_':
        zoomBy(cy, 1 / ZOOM_STEP)
        break
      case 'f':
      case 'F':
      case '0':
        cy.fit(undefined, 36)
        break
      default:
        return
    }
    ev.preventDefault()
  }

  const exportPng = (): void => {
    const cy = cyRef.current
    if (!cy || !snapshot) return
    const a = document.createElement('a')
    a.href = cy.png({ full: true, scale: 2, bg: cssVar('--canvas') })
    a.download = `spydr-web-${snapshot.domain}-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  const resetView = (): void => {
    pendingOrganize.current = true
    setScope('forest')
    setGroupsOnly(false)
    setUserQuery('')
    setExpandedOus(new Set())
    select(null)
    if (!userQuery && !selectedId && scope === 'forest' && !groupsOnly) {
      pendingOrganize.current = false
      const cy = cyRef.current
      if (cy) runLayout(cy, modeRef.current, densityRef.current)
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
        <div className="seg" role="toolbar" aria-label="Layout mode">
          <button type="button" className={mode === 'tree' ? 'active' : ''} aria-pressed={mode === 'tree'} onClick={() => changeMode('tree')}>
            Tree
          </button>
          <button type="button" className={mode === 'web' ? 'active' : ''} aria-pressed={mode === 'web'} onClick={() => changeMode('web')}>
            Organic
          </button>
        </div>
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
          <button type="button" onClick={exportPng}>
            Export
          </button>
          <button type="button" onClick={resetView}>
            Reset
          </button>
          {expandedOus.size > 0 ? (
            <button type="button" onClick={() => setExpandedOus(new Set())}>
              Fold OUs
            </button>
          ) : null}
        </div>
      </div>
      <div
        className={grid ? 'web-wrap has-grid' : 'web-wrap'}
        ref={wrap}
        tabIndex={0}
        role="application"
        aria-label="Membership web canvas. Arrow keys move between nodes, Enter centers the selection, plus and minus zoom, F fits the view, Escape clears the selection."
        onKeyDown={onCanvasKeys}
      >
        <div className="web-canvas" ref={host} />
        <div className="web-status" aria-live="polite">
          <span>{hint}</span>
          <span className="web-status-counts">
            {shown.nodes} node{shown.nodes === 1 ? '' : 's'} · {shown.edges} edge{shown.edges === 1 ? '' : 's'}
            {shown.collapsed > 0
              ? ` · ${shown.collapsed} groups folded into ${shown.clusters} OU${shown.clusters === 1 ? '' : 's'} — click a cluster to expand`
              : ''}
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
          <span className="legend-row">
            <span className="legend-line line-member" /> Member of
          </span>
          <span className="legend-row">
            <span className="legend-line line-primary" /> Primary group
          </span>
          <span className="legend-keys">←→ move · ⏎ center · esc clear</span>
        </div>
        <div className="web-corner">
          <WebMinimap cy={cyInstance} />
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
    </div>
  )
}
