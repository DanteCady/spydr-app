import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TypeGlyph } from '../components/TypeGlyph'
import { StatusBadges } from '../components/StatusBadges'
import { typeLabel } from '../lib/format'
import {
  buildOuTree,
  dominantChildType,
  expandableIds,
  isSystemContainer,
  objectsInContainer,
  type OuTreeNode
} from '../lib/tree'
import { useApp } from '../state'

function TreeRows({
  nodes,
  depth,
  selectedDn,
  contains,
  isOpen,
  onToggle,
  onSelect
}: {
  nodes: OuTreeNode[]
  depth: number
  selectedDn: string | null
  contains: Map<string, import('@shared/types').DirectoryObjectType>
  isOpen: (id: string) => boolean
  onToggle: (id: string) => void
  onSelect: (dn: string) => void
}) {
  return (
    <>
      {nodes.map((n) => {
        const hasKids = n.children.length > 0
        const expanded = hasKids && isOpen(n.id)
        return (
          <div key={n.id}>
            <button
              type="button"
              className={`tree-row${selectedDn === n.dn ? ' selected' : ''}`}
              style={{ paddingLeft: 6 + depth * 12 }}
              onClick={() => onSelect(n.dn)}
            >
              <span
                className="tree-twist"
                onClick={(e) => {
                  e.stopPropagation()
                  if (hasKids) onToggle(n.id)
                }}
              >
                {hasKids ? (expanded ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />) : null}
              </span>
              <TypeGlyph type={n.type} node={n.node} contains={contains.get(n.dn.toLowerCase())} />
              <span className="tree-name">{n.name}</span>
            </button>
            {expanded ? (
              <TreeRows
                nodes={n.children}
                depth={depth + 1}
                selectedDn={selectedDn}
                contains={contains}
                isOpen={isOpen}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

export function Directory() {
  const { snapshot, selectedId, containerDn, search, select, setContainerDn } = useApp()
  const [showSystem, setShowSystem] = useState(false)
  // undefined = follow the default (expanded); a boolean is an explicit user choice.
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const contains = useMemo(() => (snapshot ? dominantChildType(snapshot.nodes) : new Map()), [snapshot])
  const tree = useMemo(
    () => (snapshot ? buildOuTree(snapshot.nodes, snapshot.baseDn, { includeSystem: showSystem }) : []),
    [snapshot, showSystem]
  )
  const rows = useMemo(() => {
    if (!snapshot) return []
    // The list hides AD's own containers alongside the tree, so both panes agree.
    const visible = (n: (typeof snapshot.nodes)[number]): boolean =>
      showSystem || !isSystemContainer(n, snapshot.baseDn)
    const q = search.trim().toLowerCase()
    if (q) {
      return snapshot.nodes.filter((n) => {
        if (!visible(n)) return false
        const hay = `${n.displayName} ${n.name} ${n.sAMAccountName} ${n.userPrincipalName ?? ''} ${n.description}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return objectsInContainer(snapshot.nodes, containerDn ?? snapshot.baseDn, false).filter(visible)
  }, [snapshot, containerDn, search, showSystem])

  if (!snapshot) return null

  const isOpen = (id: string): boolean => open[id] ?? true
  const toggle = (id: string): void => setOpen((s) => ({ ...s, [id]: !isOpen(id) }))
  const setAll = (value: boolean): void =>
    setOpen(Object.fromEntries(expandableIds(tree).map((id) => [id, value])))

  const containerName = snapshot.nodes.find((n) => n.dn === containerDn)?.displayName ?? snapshot.domain

  return (
    <>
      <div className="split-tree">
        <div className="tree-head">
          <button type="button" className="tb-btn" title="Expand all" onClick={() => setAll(true)}>
            <ChevronsUpDown size={14} aria-hidden />
            <span>Expand</span>
          </button>
          <button type="button" className="tb-btn" title="Collapse all" onClick={() => setAll(false)}>
            <ChevronsDownUp size={14} aria-hidden />
            <span>Collapse</span>
          </button>
          <button
            type="button"
            className={showSystem ? 'tb-btn active' : 'tb-btn'}
            aria-pressed={showSystem}
            title={showSystem ? 'Hide Active Directory system containers' : 'Show Active Directory system containers'}
            onClick={() => setShowSystem((on) => !on)}
          >
            {showSystem ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
          </button>
        </div>
        <div className="tree">
          <TreeRows
            nodes={tree}
            depth={0}
            selectedDn={containerDn}
            contains={contains}
            isOpen={isOpen}
            onToggle={toggle}
            onSelect={setContainerDn}
          />
        </div>
      </div>
      <div className="split-list">
        <div className="list-head">
          <span>{search.trim() ? `Search results (${rows.length})` : containerName}</span>
          <span>{rows.length} objects</span>
        </div>
        <div className="scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr
                  key={n.id}
                  className={selectedId === n.id ? 'selected' : ''}
                  onClick={() => {
                    select(n.id)
                    if (n.type === 'ou' || n.type === 'container') setContainerDn(n.dn)
                  }}
                >
                  <td>
                    <span className="name-cell">
                      <TypeGlyph type={n.type} node={n} contains={contains.get(n.dn.toLowerCase())} />
                      {n.displayName}
                    </span>
                  </td>
                  <td className="muted">{typeLabel(n.type)}</td>
                  <td className="muted">{n.description || '—'}</td>
                  <td>
                    <StatusBadges node={n} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No objects in this container.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
