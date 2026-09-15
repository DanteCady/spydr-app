import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { membershipReach, membersOf, nodeById } from '@shared/graph'
import type { DirectoryNode, DirectorySnapshot } from '@shared/types'
import { StatusBadges } from './StatusBadges'
import { TypeGlyph } from './TypeGlyph'

interface OutlineRow {
  key: string
  id: string
  node: DirectoryNode
  depth: number
  hasChildren: boolean
  expanded: boolean
  cycleBack: boolean
  reference: boolean
}

function childrenOf(snapshot: DirectorySnapshot, byId: Map<string, DirectoryNode>, id: string): DirectoryNode[] {
  return membersOf(snapshot.edges, id)
    .map((cid) => byId.get(cid))
    .filter((n): n is DirectoryNode => Boolean(n))
    .sort(
      (a, b) =>
        (a.type === 'group' ? 0 : 1) - (b.type === 'group' ? 0 : 1) ||
        a.displayName.localeCompare(b.displayName)
    )
}

/** Top-level groups: groups not nested into any other group. Cycle-only groups are added back as roots. */
function rootGroups(snapshot: DirectorySnapshot, byId: Map<string, DirectoryNode>): DirectoryNode[] {
  const groups = snapshot.nodes.filter((n) => n.type === 'group')
  const nestedInto = new Set<string>()
  for (const e of snapshot.edges) {
    if (byId.get(e.from)?.type === 'group' && byId.get(e.to)?.type === 'group') nestedInto.add(e.from)
  }
  const roots = groups.filter((g) => !nestedInto.has(g.id))
  // Groups reachable downward from a root are covered; the rest live only inside cycles.
  const covered = new Set<string>()
  const mark = (id: string): void => {
    if (covered.has(id)) return
    covered.add(id)
    for (const c of childrenOf(snapshot, byId, id)) if (c.type === 'group') mark(c.id)
  }
  roots.forEach((r) => mark(r.id))
  const orphanCycles = groups.filter((g) => !covered.has(g.id))
  return [...roots, ...orphanCycles].sort(
    (a, b) => Number(Boolean(b.privileged)) - Number(Boolean(a.privileged)) || a.displayName.localeCompare(b.displayName)
  )
}

export function MembershipOutline({
  snapshot,
  graph,
  selectedId,
  onSelect
}: {
  snapshot: DirectorySnapshot
  graph: Parameters<typeof membershipReach>[0]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const byId = useMemo(() => nodeById(snapshot.nodes), [snapshot])
  const roots = useMemo(() => rootGroups(snapshot, byId), [snapshot, byId])
  const [query, setQuery] = useState('')
  const [privOnly, setPrivOnly] = useState(false)

  // Default-open the nesting chains that lead into privileged groups, plus every root.
  const defaultOpen = useMemo(() => {
    const open = new Set<string>(roots.map((r) => r.id))
    for (const n of snapshot.nodes) {
      if (!n.privileged) continue
      open.add(n.id)
      for (const g of membershipReach(graph, n.id, { direction: 'out' })) open.add(g)
    }
    return open
  }, [snapshot, graph, roots])

  const [openState, setOpenState] = useState<Record<string, boolean>>({})
  const isOpen = (id: string): boolean => openState[id] ?? defaultOpen.has(id)
  const toggle = (id: string): void => setOpenState((s) => ({ ...s, [id]: !isOpen(id) }))

  // keepSet limits which subtrees render for the privileged filter / search.
  const keepSet = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!privOnly && !q) return null
    const keep = new Set<string>()
    const add = (id: string): void => {
      keep.add(id)
      for (const g of membershipReach(graph, id, { direction: 'out' })) keep.add(g)
    }
    for (const n of snapshot.nodes) {
      const matchesQuery = q
        ? `${n.displayName} ${n.sAMAccountName} ${n.userPrincipalName ?? ''} ${n.description}`.toLowerCase().includes(q)
        : true
      const matchesPriv = privOnly ? Boolean(n.privileged) : true
      if (matchesQuery && matchesPriv) add(n.id)
    }
    return keep
  }, [snapshot, graph, query, privOnly])

  const rows = useMemo(() => {
    const out: OutlineRow[] = []
    const seenGroups = new Set<string>()
    const walk = (node: DirectoryNode, depth: number, path: Set<string>): void => {
      if (keepSet && !keepSet.has(node.id)) return
      const cycleBack = path.has(node.id)
      const reference = !cycleBack && node.type === 'group' && seenGroups.has(node.id)
      const kids = node.type === 'group' && !cycleBack && !reference ? childrenOf(snapshot, byId, node.id) : []
      const visibleKids = keepSet ? kids.filter((k) => keepSet.has(k.id)) : kids
      const expanded = keepSet ? true : isOpen(node.id)
      out.push({
        key: `${path.size}:${node.id}:${out.length}`,
        id: node.id,
        node,
        depth,
        hasChildren: visibleKids.length > 0,
        expanded,
        cycleBack,
        reference
      })
      if (cycleBack || reference || !expanded) return
      if (node.type === 'group') seenGroups.add(node.id)
      const nextPath = new Set(path).add(node.id)
      for (const k of visibleKids) walk(k, depth + 1, nextPath)
    }
    for (const r of roots) walk(r, 0, new Set())
    return out
  }, [snapshot, byId, roots, keepSet, openState, defaultOpen])

  return (
    <div className="outline">
      <div className="outline-head">
        <input
          type="search"
          placeholder="Filter groups & users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className={privOnly ? 'chip active' : 'chip'}
          aria-pressed={privOnly}
          onClick={() => setPrivOnly((on) => !on)}
        >
          <ShieldAlert size={12} aria-hidden /> Privileged
        </button>
      </div>
      <div className="outline-scroll" role="tree" aria-label="Membership outline">
        {rows.map((r) => (
          <div
            key={r.key}
            role="treeitem"
            aria-selected={selectedId === r.id}
            aria-expanded={r.hasChildren ? r.expanded : undefined}
            className={`outline-row${selectedId === r.id ? ' selected' : ''}${r.reference || r.cycleBack ? ' faint' : ''}`}
            style={{ paddingLeft: 6 + r.depth * 15 }}
            onClick={() => onSelect(r.id)}
          >
            <span
              className="outline-twist"
              onClick={(e) => {
                e.stopPropagation()
                if (r.hasChildren) toggle(r.id)
              }}
            >
              {r.hasChildren ? (r.expanded ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />) : null}
            </span>
            <TypeGlyph type={r.node.type} />
            <span className="outline-name">{r.node.displayName}</span>
            {r.cycleBack ? <span className="outline-tag cycle">↺ cycle</span> : null}
            {r.reference ? <span className="outline-tag ref">↗ shown above</span> : null}
            {!r.cycleBack && !r.reference ? <StatusBadges node={r.node} /> : null}
          </div>
        ))}
        {rows.length === 0 ? <div className="empty">No matches.</div> : null}
      </div>
    </div>
  )
}
