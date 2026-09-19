import cytoscape from 'cytoscape'
import { ChevronsDownUp, ChevronsUpDown, Download, GitBranch, Grid2x2, Info, Maximize, Minus, Network, Plus, RotateCcw, Route, Shapes, Type, Wand2 } from 'lucide-react'
import dagre from 'cytoscape-dagre'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppearanceSettings } from '@shared/settings'
import type { DirectoryObjectType } from '@shared/types'
import type { DirectoryNode, DirectorySnapshot } from '@shared/types'
import { buildMembershipGraph, enumeratePaths, findGroupCycles, groupIdSet, membershipReach } from '@shared/graph'
import { FindingCard } from '../components/FindingCard'
import { DirectoryTree } from '../components/DirectoryTree'
import { StatusBadges } from '../components/StatusBadges'
import { TypeGlyph, webNodeIcon } from '../components/TypeGlyph'
import { WebMinimap } from '../components/WebMinimap'
import { isSystemContainer } from '../lib/tree'
import { useMenuCommand } from '../lib/useMenuCommand'
import { useApp } from '../state'

cytoscape.use(dagre as Parameters<typeof cytoscape.use>[0])

type Density = AppearanceSettings['canvasDensity']
/** Tree ranks membership upward; structure fans containment out to the right from the focus. */
type LayoutMode = AppearanceSettings['canvasLayout']

const ZOOM_MIN = 0.2
const ZOOM_MAX = 4
const ZOOM_STEP = 1.28
const GRID_STEP = 28
const FOCUS_CAP = 48
// Labels sit under the node and are wider than it, so siblings must be separated by more than
// LABEL_WIDTH or their names collide. Ranks leave room for a wrapped label plus the next node.
const LABEL_WIDTH = 84
/**
 * Spacing per density. Auto scales with the size of the neighbourhood: a handful of nodes wants to
 * sit close together, fifty need room, and past that more space stops helping.
 */
function spacingFor(density: Density, count: number): { node: number; rank: number } {
  if (density === 'compact') return { node: 26, rank: 58 }
  if (density === 'spread') return { node: 52, rank: 88 }
  const k = Math.min(count, 60)
  return { node: Math.round(22 + k * 0.7), rank: Math.round(54 + k * 0.8) }
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function iconColor(type: DirectoryObjectType, privileged: boolean): string {
  if (privileged) return cssVar('--crit')
  return cssVar(type === 'user' ? '--user' : type === 'group' ? '--group' : type === 'computer' ? '--computer' : '--ou')
}

function buildWebStyle(labels: boolean, mode: LayoutMode): cytoscape.StylesheetJson {
  const text = cssVar('--foreground')
  const canvas = cssVar('--canvas')
  const brand = cssVar('--brand')
  const crit = cssVar('--crit')
  const member = cssVar('--edge-member')
  const primary = cssVar('--edge-primary')
  return [
    // Visio/Lucidchart style: a box with the icon above the name, both inside it. Stacking keeps
    // boxes narrow; the icon-only mode drops the label for a compact overview.
    {
      selector: 'node',
      style: {
        shape: 'round-rectangle',
        'corner-radius': '6px',
        'background-color': cssVar('--card'),
        'background-opacity': 1,
        'border-width': 1.25,
        'border-color': cssVar('--user'),
        'background-image': 'data(icon)',
        'background-fit': 'none',
        'background-width': labels ? '18px' : '22px',
        'background-height': labels ? '18px' : '22px',
        'background-position-x': '50%',
        'background-position-y': labels ? '11px' : '50%',
        'background-clip': 'node',
        label: labels ? 'data(label)' : '',
        color: text,
        'font-size': 10.5,
        'font-weight': 500,
        'font-family': 'IBM Plex Sans, system-ui, sans-serif',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-margin-y': 13,
        'text-wrap': 'wrap',
        'text-max-width': `${mode === 'structure' ? 128 : LABEL_WIDTH}px`,
        'text-overflow-wrap': 'whitespace',
        'min-zoomed-font-size': 7,
        'transition-property': 'opacity',
        'transition-duration': 120,
        // Uniform boxes in the flow chart; membership views size to the label so long group names
        // do not force every box wide.
        width: !labels ? 44 : mode === 'structure' ? 150 : 'label',
        height: labels ? 62 : 44,
        padding: labels ? '12px' : '0px'
      }
    },
    {
      selector: 'node[kind = "group"]',
      style: { 'border-color': cssVar('--group'), 'font-weight': 600 }
    },
    {
      selector: 'node[kind = "computer"]',
      style: { 'border-color': cssVar('--computer') }
    },
    {
      selector: 'node[privileged = 1]',
      style: {
        'border-color': crit,
        'border-width': 1.75,
        'underlay-color': crit,
        'underlay-opacity': 0.09,
        'underlay-padding': 5,
        'underlay-shape': 'round-rectangle'
      }
    },
    {
      selector: 'node[cycle = 1]',
      style: { 'border-style': 'dashed', 'border-color': crit }
    },
    // the anchor of the current neighbourhood
    {
      selector: 'node:selected',
      style: {
        'border-color': brand,
        'border-width': 2.25,
        'underlay-color': brand,
        'underlay-opacity': 0.16,
        'underlay-padding': 6,
        'underlay-shape': 'round-rectangle'
      }
    },
    {
      selector: 'edge',
      style: {
        width: 'mapData(w, 1, 10, 1.6, 4)',
        // Both views are flow charts: right angles read as structure, curves read as decoration.
        'curve-style': 'taxi' as const,
        'taxi-direction': (mode === 'tree' ? 'upward' : 'rightward') as 'upward' | 'rightward',
        'taxi-turn': '50%',
        'taxi-turn-min-distance': '10px',
        'line-color': member,
        'target-arrow-color': member,
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1,
        opacity: 0.9,
        label: 'data(rel)',
        'font-size': 8,
        'font-family': 'IBM Plex Mono, ui-monospace, monospace',
        color: member,
        'text-opacity': 0,
        'text-rotation': 'none',
        'text-background-color': canvas,
        'text-background-opacity': 0.9,
        'text-background-padding': '2px',
        'transition-property': 'opacity',
        'transition-duration': 120
      }
    },
    {
      selector: 'edge[via = "contains"]',
      style: {
        'line-color': cssVar('--border'),
        'target-arrow-color': cssVar('--border'),
        'target-arrow-shape': 'none',
        width: 1.5,
        opacity: 1
      }
    },
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
    // Trace: the path stands out and everything else recedes, so one chain can be read alone.
    {
      selector: 'node.dimmed',
      style: { opacity: 0.1, 'text-opacity': 0.1 }
    },
    {
      selector: 'edge.dimmed',
      style: { opacity: 0.06, 'text-opacity': 0 }
    },
    {
      selector: 'node.on-path',
      style: {
        'border-color': brand,
        'border-width': 2.5,
        'underlay-color': brand,
        'underlay-opacity': 0.22,
        'underlay-padding': 7,
        'underlay-shape': 'round-rectangle',
        'z-index': 20
      }
    },
    {
      selector: 'edge.on-path',
      style: {
        'line-color': brand,
        'target-arrow-color': brand,
        width: 3,
        opacity: 1,
        'line-style': 'dashed',
        'line-dash-pattern': [9, 5],
        'z-index': 20
      }
    },
    {
      selector: 'edge.sel',
      style: {
        width: 2.6,
        'line-color': brand,
        'target-arrow-color': brand,
        opacity: 1
      }
    },
    {
      selector: 'edge.hover',
      style: {
        width: 3,
        'line-color': brand,
        'target-arrow-color': brand,
        color: brand,
        'text-opacity': 1,
        opacity: 1
      }
    }
  ]
}

/** The neighborhood drawn for a focus: its full upward nesting chain plus members two hops down, capped. */
/**
 * What to draw for a focus. A user or group shows its own membership neighbourhood; a container has
 * no membership edges of its own, so it shows the objects it holds and the groups they reach.
 */
function focusNeighborhood(
  graph: ReturnType<typeof buildMembershipGraph>,
  focusId: string,
  snapshot: DirectorySnapshot
): { ids: Set<string>; trimmed: number; container: boolean } {
  const focus = snapshot.nodes.find((n) => n.id === focusId)
  if (focus && (focus.type === 'ou' || focus.type === 'container')) {
    const ids = new Set<string>()
    let trimmed = 0
    // Everything in the subtree, not just direct children: a top-level OU usually holds only
    // sub-OUs, so direct children alone would leave the canvas empty.
    const want = focus.dn.toLowerCase()
    const inside = snapshot.nodes.filter(
      (n) =>
        n.type !== 'ou' &&
        n.type !== 'container' &&
        (n.parentDn?.toLowerCase() === want || n.dn.toLowerCase().endsWith(`,${want}`))
    )
    for (const n of inside) {
      if (ids.size >= FOCUS_CAP) {
        trimmed++
        continue
      }
      ids.add(n.id)
      if (!graph.hasNode(n.id)) continue
      for (const g of graph.outNeighbors(n.id)) {
        if (ids.size >= FOCUS_CAP) break
        ids.add(g)
      }
    }
    return { ids, trimmed, container: true }
  }

  const ids = new Set<string>([focusId])
  let trimmed = 0
  if (!graph.hasNode(focusId)) return { ids, trimmed, container: false }
  for (const g of membershipReach(graph, focusId, { direction: 'out', maxDepth: 12 })) ids.add(g)
  const seen = new Set<string>([focusId])
  const queue: { id: string; depth: number }[] = [{ id: focusId, depth: 0 }]
  while (queue.length) {
    const step = queue.shift()
    if (!step || step.depth >= 2) continue
    for (const m of graph.inNeighbors(step.id)) {
      if (seen.has(m)) continue
      seen.add(m)
      if (ids.size >= FOCUS_CAP) {
        trimmed++
        continue
      }
      ids.add(m)
      queue.push({ id: m, depth: step.depth + 1 })
    }
  }
  return { ids, trimmed, container: false }
}

/** Below this, boxes are too small to read; pan or use the minimap instead of zooming out further. */
const MIN_FIT_ZOOM = 0.45

/** Shortest membership chain between two objects, in whichever direction one exists. */
function tracePath(
  graph: ReturnType<typeof buildMembershipGraph>,
  a: string,
  b: string
): string[] | null {
  if (a === b || !graph.hasNode(a) || !graph.hasNode(b)) return null
  const options = [
    ...enumeratePaths(graph, a, b, { maxDepth: 12, maxPaths: 16 }),
    ...enumeratePaths(graph, b, a, { maxDepth: 12, maxPaths: 16 })
  ]
  if (options.length === 0) return null
  return options.sort((x, y) => x.nodeIds.length - y.nodeIds.length)[0].nodeIds
}

interface WebNodeDef {
  id: string
  label: string
  kind: string
  privileged: number
  cycle: number
  icon: string
  /** Levels below the root in the containment tree; absent for membership views. */
  depth?: number
}

interface WebEdgeDef {
  id: string
  source: string
  target: string
  w: number
  via: string
  rel: string
}

/**
 * The structure under a container: the container itself as the root, every container beneath it,
 * and the objects they hold. Containment is a true tree, so laid out left to right it fans out from
 * the root without the edge crossings that many-to-many membership produces.
 */
function containmentElements(
  snapshot: DirectorySnapshot,
  rootId: string,
  cycles: Set<string>
): { nodes: WebNodeDef[]; edges: WebEdgeDef[]; trimmed: number } {
  const root = snapshot.nodes.find((n) => n.id === rootId)
  if (!root) return { nodes: [], edges: [], trimmed: 0 }
  const suffix = `,${root.dn.toLowerCase()}`
  const under = snapshot.nodes.filter(
    (n) =>
      (n.id === root.id || n.dn.toLowerCase().endsWith(suffix)) &&
      // The same plumbing the Directory tree hides: a domain root would otherwise be a hundred
      // GUID-named config containers rather than the structure an admin recognises.
      !isSystemContainer(n, snapshot.baseDn)
  )
  const isContainer = (n: DirectoryNode): boolean => n.type === 'ou' || n.type === 'container'
  // Drawing every user would make one column per person and turn a flow chart into a vertical
  // strip. Show the skeleton of containers, with the objects of the focused container itself so a
  // leaf OU still resolves to its members; clicking a container re-roots the view onto it.
  // Root first, then the skeleton, then leaves: when the cap bites it must never drop the root the
  // whole tree hangs from.
  const within = under
    .filter((n) => isContainer(n) || n.parentDn?.toLowerCase() === root.dn.toLowerCase())
    .sort(
      (a, b) =>
        Number(b.id === root.id) - Number(a.id === root.id) ||
        Number(isContainer(b)) - Number(isContainer(a))
    )
  const heldBy = new Map<string, number>()
  for (const n of under) {
    if (isContainer(n)) continue
    const parent = n.parentDn?.toLowerCase()
    if (parent) heldBy.set(parent, (heldBy.get(parent) ?? 0) + 1)
  }
  const byDn = new Map(within.map((n) => [n.dn.toLowerCase(), n]))
  const depthOf = (n: DirectoryNode): number =>
    n.id === root.id ? 0 : n.dn.slice(0, n.dn.length - root.dn.length).split(',').filter(Boolean).length

  const nodes: WebNodeDef[] = []
  const edges: WebEdgeDef[] = []
  let trimmed = 0
  for (const n of within) {
    if (nodes.length >= FOCUS_CAP) {
      trimmed++
      continue
    }
    const held = heldBy.get(n.dn.toLowerCase()) ?? 0
    nodes.push({
      id: n.id,
      // A container says how many objects it holds, since they are not drawn individually here.
      label: isContainer(n) && held > 0 ? `${n.displayName}  (${held})` : n.displayName,
      kind: n.type,
      privileged: n.privileged ? 1 : 0,
      cycle: cycles.has(n.id) ? 1 : 0,
      icon: webNodeIcon(n.type, iconColor(n.type, Boolean(n.privileged))),
      depth: depthOf(n)
    })
  }
  const drawn = new Set(nodes.map((n) => n.id))
  for (const n of within) {
    if (n.id === root.id || !drawn.has(n.id)) continue
    const parent = n.parentDn ? byDn.get(n.parentDn.toLowerCase()) : undefined
    if (!parent || !drawn.has(parent.id)) continue
    edges.push({ id: `${parent.id}=>${n.id}`, source: parent.id, target: n.id, w: 1, via: 'contains', rel: 'contains' })
  }
  return { nodes, edges, trimmed }
}

/**
 * Tidy tree, left to right: the root at the far left, each level one column further right, and a
 * parent sitting level with the middle of its children. Leaves take successive rows, so siblings
 * stay together and no edge ever crosses another — the property that made wrapping levels into
 * blocks unusable, however compact it was.
 */
function layoutTidyTree(cy: cytoscape.Core, gap: { node: number; rank: number }, rootId: string): void {
  // Falling back to the shallowest node keeps the tree drawn even if the root was trimmed; an early
  // return here leaves every node sitting on the origin, which reads as one giant overlap.
  const byId = cy.$id(rootId)
  const shallowest = cy
    .nodes()
    .toArray()
    .sort((a, b) => ((a.data('depth') as number) ?? 0) - ((b.data('depth') as number) ?? 0))[0]
  const root: cytoscape.NodeSingular | undefined = byId.nonempty() ? byId[0] : shallowest
  if (!root) return

  const children = new Map<string, cytoscape.NodeSingular[]>()
  cy.edges().forEach((e) => {
    const from = e.source().id()
    children.set(from, [...(children.get(from) ?? []), e.target()])
  })

  // One column per level, each wide enough for its widest box.
  const widest = new Map<number, number>()
  cy.nodes().forEach((n) => {
    const d = (n.data('depth') as number | undefined) ?? 0
    widest.set(d, Math.max(widest.get(d) ?? 0, n.width()))
  })
  const columnX = new Map<number, number>()
  let x = 0
  for (const d of [...widest.keys()].sort((a, b) => a - b)) {
    columnX.set(d, x)
    x += (widest.get(d) ?? 0) + gap.rank
  }

  const rowHeight = Math.max(...cy.nodes().map((n) => n.height())) + gap.node
  let nextLeafY = 0
  const seen = new Set<string>()

  const place = (node: cytoscape.NodeSingular): number => {
    seen.add(node.id())
    const depth = (node.data('depth') as number | undefined) ?? 0
    const kids = (children.get(node.id()) ?? [])
      .filter((k) => !seen.has(k.id()))
      .sort((a, b) => String(a.data('label') ?? '').localeCompare(String(b.data('label') ?? '')))
    let y: number
    if (kids.length === 0) {
      y = nextLeafY
      nextLeafY += rowHeight
    } else {
      const ys = kids.map(place)
      y = (ys[0] + ys[ys.length - 1]) / 2
    }
    node.position({ x: columnX.get(depth) ?? 0, y })
    return y
  }

  place(root)
  // Anything the tree did not reach (an object whose parent was trimmed) is parked below it.
  cy.nodes().forEach((n) => {
    if (seen.has(n.id())) return
    n.position({ x: columnX.get((n.data('depth') as number | undefined) ?? 0) ?? 0, y: nextLeafY })
    nextLeafY += rowHeight
  })
}

function runLayout(cy: cytoscape.Core, density: Density, mode: LayoutMode = 'tree', focusId = ''): void {
  const gap = spacingFor(density, cy.nodes().length)
  if (mode === 'structure') {
    // A tidy tree is as tall as it has leaves, so it must be allowed to fit however far out that
    // takes; clamping the zoom here would push most of the tree off screen. Rows can sit much
    // closer than in a ranked graph because nothing has to route between them.
    // Columns sit well apart so the flow reads across, and rows keep enough air to follow a branch.
    layoutTidyTree(cy, { node: Math.round(gap.node * 0.9), rank: Math.round(gap.rank * 2.2) }, focusId)
    cy.fit(undefined, 44)
    return
  }
  cy.layout({
    name: 'dagre',
    // Membership runs member -> group: BT stacks escalation upward, LR fans it out to the right.
    rankDir: 'BT',
    ranker: 'network-simplex',
    nodeSep: gap.node,
    rankSep: gap.rank,
    edgeSep: 14,
    animate: false,
    fit: true,
    padding: 44
  } as cytoscape.LayoutOptions).run()

  if (cy.zoom() < MIN_FIT_ZOOM) {
    const container = cy.container()
    cy.zoom({
      level: MIN_FIT_ZOOM,
      renderedPosition: { x: (container?.clientWidth ?? 0) / 2, y: (container?.clientHeight ?? 0) / 2 }
    })
  }
}

function orderedNodeIds(cy: cytoscape.Core): string[] {
  return cy
    .nodes()
    .toArray()
    .map((n) => ({ id: n.id(), p: n.position() }))
    .sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x)
    .map((n) => n.id)
}

function zoomBy(cy: cytoscape.Core, factor: number): void {
  const container = cy.container()
  if (!container) return
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cy.zoom() * factor))
  cy.zoom({ level: next, renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 } })
}

function syncGrid(cy: cytoscape.Core, el: HTMLElement | null): void {
  if (!el) return
  const size = GRID_STEP * cy.zoom()
  const pan = cy.pan()
  el.style.backgroundSize = `${size}px ${size}px`
  el.style.backgroundPosition = `${pan.x}px ${pan.y}px`
}

export function Web() {
  const { snapshot, selectedId, select, activeFinding, clearFinding, theme, settings } = useApp()
  // The canvas opens the way Settings says it should; changes made here are for this visit only.
  const canvas = useRef(settings.appearance).current
  const host = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const selectRef = useRef(select)
  const labelsRef = useRef(canvas.canvasLabels)
  const densityRef = useRef<Density>(canvas.canvasDensity)
  const [density, setDensity] = useState<Density>(canvas.canvasDensity)
  const [grid, setGrid] = useState(canvas.canvasGrid)
  const [labels, setLabels] = useState(canvas.canvasLabels)
  const [layout, setLayout] = useState<LayoutMode>(canvas.canvasLayout)
  const layoutRef = useRef<LayoutMode>(canvas.canvasLayout)
  const [tracing, setTracing] = useState(false)
  const [traceTarget, setTraceTarget] = useState<string | null>(null)
  const tracingRef = useRef(false)
  const setTraceTargetRef = useRef(setTraceTarget)
  const [legend, setLegend] = useState(canvas.canvasLegend)
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null)
  const [shown, setShown] = useState({ nodes: 0, edges: 0, trimmed: 0, container: false })
  const [cyInstance, setCyInstance] = useState<cytoscape.Core | null>(null)

  selectRef.current = select
  labelsRef.current = labels
  layoutRef.current = layout
  tracingRef.current = tracing
  setTraceTargetRef.current = setTraceTarget
  densityRef.current = density

  const graph = useMemo(
    () => (snapshot ? buildMembershipGraph(snapshot.nodes, snapshot.edges) : null),
    [snapshot]
  )
  const cycles = useMemo(() => {
    if (!snapshot || !graph) return new Set<string>()
    return new Set(findGroupCycles(graph, groupIdSet(snapshot.nodes)).flat())
  }, [snapshot, graph])

  // Default anchor when nothing is selected: the top privileged group, else any group.
  const defaultFocus = useMemo(() => {
    if (!snapshot) return null
    const priv = snapshot.nodes.filter((n) => n.type === 'group' && n.privileged)
    const da = priv.find((n) => n.sAMAccountName.toLowerCase().includes('domain admins'))
    return (da ?? priv[0] ?? snapshot.nodes.find((n) => n.type === 'group'))?.id ?? null
  }, [snapshot])

  const focusId = selectedId ?? defaultFocus
  const memberCounts = useMemo(() => {
    const members = new Map<string, number>()
    const memberOf = new Map<string, number>()
    for (const e of snapshot?.edges ?? []) {
      members.set(e.to, (members.get(e.to) ?? 0) + 1)
      memberOf.set(e.from, (memberOf.get(e.from) ?? 0) + 1)
    }
    return { members, memberOf }
  }, [snapshot])

  useEffect(() => {
    if (!host.current || !snapshot) return
    const cy = cytoscape({
      container: host.current,
      elements: [],
      wheelSensitivity: 0.3,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      pixelRatio: 2,
      style: buildWebStyle(labelsRef.current, layoutRef.current),
      layout: { name: 'preset' }
    })
    cy.on('tap', 'node', (ev) => {
      if (tracingRef.current) setTraceTargetRef.current(ev.target.id())
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
    syncGrid(cy, wrap.current)
    return () => {
      cy.off('viewport', onViewport)
      cy.destroy()
      cyRef.current = null
      setCyInstance(null)
    }
  }, [snapshot])

  // Rebuild the neighborhood whenever the focus changes.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !snapshot || !graph || !focusId) return
    const byId = new Map(snapshot.nodes.map((n) => [n.id, n]))
    const structural = layout === 'structure' && Boolean(
      snapshot.nodes.find((n) => n.id === focusId && (n.type === 'ou' || n.type === 'container'))
    )
    const built = structural ? containmentElements(snapshot, focusId, cycles) : null
    const { ids, trimmed, container } = built
      ? { ids: new Set(built.nodes.map((n) => n.id)), trimmed: built.trimmed, container: true }
      : focusNeighborhood(graph, focusId, snapshot)

    const edgeDefs = new Map<string, WebEdgeDef>()
    if (built) {
      for (const e of built.edges) edgeDefs.set(e.id, e)
    } else {
      for (const e of snapshot.edges) {
        if (!ids.has(e.from) || !ids.has(e.to)) continue
        const eid = `${e.from}->${e.to}`
        const cur = edgeDefs.get(eid)
        if (cur) {
          cur.w = Math.min(10, cur.w + 1)
        } else {
          edgeDefs.set(eid, {
            id: eid,
            source: e.from,
            target: e.to,
            w: 1,
            via: e.via,
            rel: e.via === 'primaryGroup' ? 'primary group' : 'member of'
          })
        }
      }
    }
    const edgeIds = new Set(edgeDefs.keys())

    cy.batch(() => {
      cy.nodes().filter((n) => !ids.has(n.id())).remove()
      cy.edges().filter((e) => !edgeIds.has(e.id())).remove()
      // Depth is per view, so it must be written to nodes that are being reused as well as to new
      // ones; otherwise switching into the structure view leaves every node at the same level.
      const depthById = new Map(built?.nodes.map((n) => [n.id, n.depth ?? 0]) ?? [])
      for (const id of ids) {
        const n = byId.get(id)
        if (!n) continue
        const existing = cy.$id(id)
        if (existing.nonempty()) {
          existing.data('depth', depthById.get(id))
          continue
        }
        cy.add({
          data: {
            id: n.id,
            label: n.displayName,
            kind: n.type,
            privileged: n.privileged ? 1 : 0,
            cycle: cycles.has(n.id) ? 1 : 0,
            icon: webNodeIcon(n.type, iconColor(n.type, Boolean(n.privileged))),
            depth: depthById.get(id)
          }
        })
      }
      for (const def of edgeDefs.values()) {
        if (cy.$id(def.id).nonempty()) continue
        cy.add({ data: { ...def } })
      }
      cy.edges().forEach((ed) => {
        ed.toggleClass('cyc', ed.source().data('cycle') === 1 && ed.target().data('cycle') === 1)
      })
    })

    runLayout(cy, densityRef.current, layoutRef.current, focusId ?? '')
    cy.nodes().unselect()
    cy.edges().removeClass('sel')
    if (cy.$id(focusId).nonempty()) {
      cy.$id(focusId).select()
      cy.$id(focusId).connectedEdges().addClass('sel')
    }
    setShown({ nodes: cy.nodes().length, edges: cy.edges().length, trimmed, container })
  }, [snapshot, graph, cycles, focusId, layout])

  useEffect(() => {
    setTraceTarget(null)
  }, [focusId])

  useEffect(() => {
    const cy = cyRef.current
    if (cy) syncGrid(cy, wrap.current)
  }, [grid])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || cy.destroyed() || !graph || !focusId) return
    cy.batch(() => {
      cy.elements().removeClass('dimmed on-path')
    })
    if (!tracing || !traceTarget) return
    const path = tracePath(graph, focusId, traceTarget)
    if (!path) return
    const ids = new Set(path)
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        n.addClass(ids.has(n.id()) ? 'on-path' : 'dimmed')
      })
      cy.edges().forEach((e) => {
        const onPath =
          ids.has(e.source().id()) &&
          ids.has(e.target().id()) &&
          Math.abs(path.indexOf(e.source().id()) - path.indexOf(e.target().id())) === 1
        e.addClass(onPath ? 'on-path' : 'dimmed')
      })
    })
    // Marching dashes along the traced chain, so direction of travel is obvious.
    let offset = 0
    const timer = window.setInterval(() => {
      if (cy.destroyed()) return
      offset = (offset - 1) % 28
      cy.edges('.on-path').style('line-dash-offset', offset)
    }, 45)
    return () => window.clearInterval(timer)
  }, [tracing, traceTarget, focusId, graph, shown])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || cy.destroyed()) return
    cy.style(buildWebStyle(labels, layout))
    runLayout(cy, densityRef.current, layout, focusId ?? '') // box size or edge routing changed, so redo the ranks
  }, [labels, layout])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const cy = cyRef.current
      if (!cy || cy.destroyed()) return
      cy.style(buildWebStyle(labelsRef.current, layoutRef.current))
      cy.nodes().forEach((n) => {
        const kind = n.data('kind') as DirectoryObjectType
        n.data('icon', webNodeIcon(kind, iconColor(kind, n.data('privileged') === 1)))
      })
      cy.emit('viewport')
    })
    return () => cancelAnimationFrame(id)
  }, [theme])

  if (!snapshot) return null

  const tipNode = tip ? snapshot.nodes.find((n) => n.id === tip.id) : null
  const focusNode = snapshot.nodes.find((n) => n.id === focusId)
  const hint = focusNode
    ? focusNode.displayName
    : 'Pick a group or user from the outline'

  const relayout = (next?: Density): void => {
    if (next) {
      densityRef.current = next
      setDensity(next)
    }
    const cy = cyRef.current
    if (cy) runLayout(cy, next ?? densityRef.current, layoutRef.current, focusId ?? '')
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
      case 'Escape':
        if (traceTarget) setTraceTarget(null)
        else if (tracing) setTracing(false)
        else select(null)
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
        cy.fit(undefined, 44)
        break
      default:
        return
    }
    ev.preventDefault()
  }

  const exportPng = (): void => {
    const cy = cyRef.current
    if (!cy) return
    const a = document.createElement('a')
    a.href = cy.png({ full: true, scale: 2, bg: cssVar('--canvas') })
    a.download = `spydr-web-${snapshot.domain}-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  // The View > Canvas menu drives the same state the toolbar does.
  useMenuCommand((command) => {
    const cy = cyRef.current
    if (command === 'canvas:tree') setLayout('tree')
    else if (command === 'canvas:structure') setLayout('structure')
    else if (command === 'canvas:grid') setGrid((on) => !on)
    else if (command === 'canvas:legend') setLegend((on) => !on)
    else if (command === 'canvas:labels') setLabels((on) => !on)
    else if (command === 'canvas:trace') {
      setTracing((on) => !on)
      setTraceTarget(null)
    } else if (command === 'canvas:zoom-in' && cy) zoomBy(cy, ZOOM_STEP)
    else if (command === 'canvas:zoom-out' && cy) zoomBy(cy, 1 / ZOOM_STEP)
    else if (command === 'canvas:fit' && cy) cy.fit(undefined, 44)
    else if (command === 'canvas:reset') select(null)
    else if (command === 'file:export') exportPng()
  })

  return (
    <div className="web-split">
      <DirectoryTree snapshot={snapshot} selectedId={selectedId} onSelect={select} />
      <div className="web-graph">
        <div className="toolbar web-toolbar">
          <div className="web-title" aria-live="polite">
            <span className="web-title-focus">
              {focusNode ? <TypeGlyph type={focusNode.type} /> : null}
              {hint}
            </span>
            <span className="web-title-meta">
              {shown.container ? 'contents' : 'neighborhood'} · {shown.nodes} node{shown.nodes === 1 ? '' : 's'} · {shown.edges} edge{shown.edges === 1 ? '' : 's'}
              {shown.trimmed > 0 ? ` · +${shown.trimmed} hidden — click a member to walk in` : ''}
            </span>
          </div>
          <div className="tb-group" role="toolbar" aria-label="Layout">
            <button type="button" className={`tb-btn${layout === 'tree' ? ' active' : ''}`} aria-pressed={layout === 'tree'} title="Membership, escalation upward" onClick={() => setLayout('tree')}>
              <Network size={15} aria-hidden />
              <span>Tree</span>
            </button>
            <button type="button" className={`tb-btn${layout === 'structure' ? ' active' : ''}`} aria-pressed={layout === 'structure'} title="Structure, fanning out to the right from the focus" onClick={() => setLayout('structure')}>
              <GitBranch size={15} aria-hidden />
              <span>Structure</span>
            </button>
          </div>
          <div className="tb-group" role="toolbar" aria-label="Spacing">
            <button type="button" className={`tb-btn${density === 'auto' ? ' active' : ''}`} aria-pressed={density === 'auto'} title="Fit the spacing to the size of the view" onClick={() => relayout('auto')}>
              <Wand2 size={15} aria-hidden />
              <span>Auto</span>
            </button>
            <button type="button" className={`tb-btn${density === 'compact' ? ' active' : ''}`} aria-pressed={density === 'compact'} title="Compact spacing" onClick={() => relayout('compact')}>
              <ChevronsDownUp size={15} aria-hidden />
              <span>Compact</span>
            </button>
            <button type="button" className={`tb-btn${density === 'spread' ? ' active' : ''}`} aria-pressed={density === 'spread'} title="Spread spacing" onClick={() => relayout('spread')}>
              <ChevronsUpDown size={15} aria-hidden />
              <span>Spread</span>
            </button>
          </div>
          <div className="tb-group" role="toolbar" aria-label="View">
            <button type="button" className={`tb-btn${grid ? ' active' : ''}`} aria-pressed={grid} title="Toggle grid" onClick={() => setGrid((on) => !on)}>
              <Grid2x2 size={15} aria-hidden />
              <span>Grid</span>
            </button>
            <button type="button" className={`tb-btn${legend ? ' active' : ''}`} aria-pressed={legend} title="Toggle legend" onClick={() => setLegend((on) => !on)}>
              <Info size={15} aria-hidden />
              <span>Legend</span>
            </button>
            <button
              type="button"
              className={`tb-btn${tracing ? ' active' : ''}`}
              aria-pressed={tracing}
              title={tracing ? 'Stop tracing' : 'Trace a path from the focus'}
              onClick={() => {
                setTracing((on) => !on)
                setTraceTarget(null)
              }}
            >
              <Route size={15} aria-hidden />
              <span>Trace</span>
            </button>
            <button
              type="button"
              className={`tb-btn${labels ? '' : ' active'}`}
              aria-pressed={!labels}
              title={labels ? 'Show icons only' : 'Show names'}
              onClick={() => setLabels((on) => !on)}
            >
              {labels ? <Type size={15} aria-hidden /> : <Shapes size={15} aria-hidden />}
              <span>{labels ? 'Names' : 'Icons'}</span>
            </button>
          </div>
          <div className="tb-group" role="toolbar" aria-label="Actions">
            <button type="button" className="tb-btn" title="Export PNG" onClick={exportPng}>
              <Download size={15} aria-hidden />
              <span>Export</span>
            </button>
            <button type="button" className="tb-btn" title="Back to the default focus" onClick={() => select(null)}>
              <RotateCcw size={15} aria-hidden />
              <span>Reset</span>
            </button>
          </div>
        </div>
        <div
          className={grid ? 'web-wrap has-grid' : 'web-wrap'}
          ref={wrap}
          tabIndex={0}
          role="application"
          aria-label="Focus graph. Arrow keys move between nodes, plus and minus zoom, F fits, Escape returns to the default focus."
          onKeyDown={onCanvasKeys}
        >
          <div className="web-canvas" ref={host} />
          {shown.nodes === 0 ? (
            <div className="web-empty">
              <p className="empty-title">Nothing to draw here</p>
              <p className="empty-hint">
                {focusNode
                  ? `${focusNode.displayName} holds no users, groups or computers.`
                  : 'Pick a user, group or container from the directory.'}
              </p>
            </div>
          ) : null}
          {activeFinding &&
          (activeFinding.type === 'circular-nesting' ||
            activeFinding.type === 'deep-nesting' ||
            activeFinding.type === 'distribution-in-security') ? (
            <div className="web-finding">
              <FindingCard finding={activeFinding} onDismiss={clearFinding} />
            </div>
          ) : null}
          {tip && tipNode ? (
            <div className={tip.y < 150 ? 'web-tip below' : 'web-tip'} style={{ left: tip.x, top: tip.y }} role="tooltip">
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
          {legend ? (
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
          </div>
          ) : null}
          <div className="web-corner">
            <WebMinimap cy={cyInstance} />
            <div className="web-controls">
              <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => cyRef.current && zoomBy(cyRef.current, ZOOM_STEP)}>
                <Plus size={14} aria-hidden />
              </button>
              <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => cyRef.current && zoomBy(cyRef.current, 1 / ZOOM_STEP)}>
                <Minus size={14} aria-hidden />
              </button>
              <button type="button" aria-label="Fit to view" title="Fit to view" onClick={() => cyRef.current?.fit(undefined, 44)}>
                <Maximize size={14} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
