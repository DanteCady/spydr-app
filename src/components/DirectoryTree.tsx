import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DirectoryNode, DirectorySnapshot } from '@shared/types'
import { buildOuTree, dominantChildType, objectsInContainer, type OuTreeNode } from '../lib/tree'
import { StatusBadges } from './StatusBadges'
import { TypeGlyph } from './TypeGlyph'

interface Row {
  key: string
  id: string
  node: DirectoryNode
  depth: number
  isContainer: boolean
  hasChildren: boolean
  expanded: boolean
}

/**
 * The same directory the Directory workspace shows, but with the objects inside each container, so
 * one navigator serves every workspace. Objects are only built for expanded containers, which keeps
 * a large directory cheap.
 */
export function DirectoryTree({
  snapshot,
  selectedId,
  onSelect
}: {
  snapshot: DirectorySnapshot
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [privOnly, setPrivOnly] = useState(false)
  // The root opens by default; a single collapsed row is a poor first impression.
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const rootIds = useMemo(() => new Set(buildOuTree(snapshot.nodes, snapshot.baseDn).map((r) => r.id)), [snapshot])

  const tree = useMemo(() => buildOuTree(snapshot.nodes, snapshot.baseDn), [snapshot])
  const contains = useMemo(() => dominantChildType(snapshot.nodes), [snapshot])
  const byDn = useMemo(
    () => new Map(snapshot.nodes.map((n) => [n.dn.toLowerCase(), n])),
    [snapshot]
  )

  const q = query.trim().toLowerCase()
  const matches = (n: DirectoryNode): boolean => {
    if (privOnly && !n.privileged) return false
    if (!q) return true
    return `${n.displayName} ${n.sAMAccountName} ${n.userPrincipalName ?? ''} ${n.description}`
      .toLowerCase()
      .includes(q)
  }

  /** Containers holding a match, so a filtered tree still shows the path down to a hit. */
  const keepContainers = useMemo(() => {
    if (!q && !privOnly) return null
    const keep = new Set<string>()
    for (const n of snapshot.nodes) {
      if (n.type === 'ou' || n.type === 'container' || !matches(n)) continue
      let dn = n.parentDn?.toLowerCase()
      while (dn) {
        if (keep.has(dn)) break
        keep.add(dn)
        dn = byDn.get(dn)?.parentDn?.toLowerCase()
      }
    }
    return keep
  }, [snapshot, q, privOnly, byDn])

  const filtering = keepContainers !== null
  const isOpen = (id: string, dn: string): boolean =>
    filtering ? keepContainers.has(dn.toLowerCase()) : (open[id] ?? rootIds.has(id))

  const rows = useMemo(() => {
    const out: Row[] = []
    const walk = (nodes: OuTreeNode[], depth: number): void => {
      for (const c of nodes) {
        const dnKey = c.dn.toLowerCase()
        if (filtering && !keepContainers.has(dnKey)) continue
        const objects = objectsInContainer(snapshot.nodes, c.dn, false)
          .filter((n) => n.type !== 'ou' && n.type !== 'container')
          .filter(matches)
          .sort(
            (a, b) =>
              (a.type === 'group' ? 0 : 1) - (b.type === 'group' ? 0 : 1) ||
              a.displayName.localeCompare(b.displayName)
          )
        const expanded = isOpen(c.id, c.dn)
        out.push({
          key: c.id,
          id: c.id,
          node: c.node,
          depth,
          isContainer: true,
          hasChildren: c.children.length > 0 || objects.length > 0,
          expanded
        })
        if (!expanded) continue
        walk(c.children, depth + 1)
        for (const o of objects) {
          out.push({ key: `${c.id}:${o.id}`, id: o.id, node: o, depth: depth + 1, isContainer: false, hasChildren: false, expanded: false })
        }
      }
    }
    walk(tree, 0)
    return out
  }, [tree, snapshot, open, filtering, keepContainers, q, privOnly, rootIds])

  return (
    <div className="outline">
      <div className="outline-head">
        <input type="search" placeholder="Filter the directory…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button
          type="button"
          className={privOnly ? 'chip active' : 'chip'}
          aria-pressed={privOnly}
          title="Privileged groups only"
          onClick={() => setPrivOnly((on) => !on)}
        >
          <ShieldAlert size={12} aria-hidden />
        </button>
      </div>
      <div className="outline-scroll" role="tree" aria-label="Directory">
        {rows.map((r) => (
          <div
            key={r.key}
            role="treeitem"
            aria-selected={selectedId === r.id}
            aria-expanded={r.hasChildren ? r.expanded : undefined}
            className={`outline-row${selectedId === r.id ? ' selected' : ''}`}
            style={{ paddingLeft: 6 + r.depth * 14 }}
            onClick={() => (r.isContainer ? setOpen((s) => ({ ...s, [r.id]: !r.expanded })) : onSelect(r.id))}
          >
            <span
              className="outline-twist"
              onClick={(e) => {
                e.stopPropagation()
                if (r.hasChildren) setOpen((s) => ({ ...s, [r.id]: !r.expanded }))
              }}
            >
              {r.hasChildren ? (r.expanded ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />) : null}
            </span>
            <TypeGlyph type={r.node.type} node={r.node} contains={contains.get(r.node.dn.toLowerCase())} />
            <span className="outline-name">{r.node.displayName}</span>
            {!r.isContainer ? <StatusBadges node={r.node} /> : null}
          </div>
        ))}
        {rows.length === 0 ? <div className="empty">No matches.</div> : null}
      </div>
    </div>
  )
}
