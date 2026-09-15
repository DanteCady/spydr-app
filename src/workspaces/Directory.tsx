import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TypeGlyph } from '../components/TypeGlyph'
import { StatusBadges } from '../components/StatusBadges'
import { typeLabel } from '../lib/format'
import { buildOuTree, objectsInContainer } from '../lib/tree'
import { useApp } from '../state'

function TreeRows({
  nodes,
  depth,
  selectedDn,
  onSelect
}: {
  nodes: ReturnType<typeof buildOuTree>
  depth: number
  selectedDn: string | null
  onSelect: (dn: string) => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(nodes.map((n) => [n.id, true])))

  return (
    <>
      {nodes.map((n) => {
        const hasKids = n.children.length > 0
        const expanded = open[n.id] !== false
        return (
          <div key={n.id}>
            <button
              type="button"
              className={`tree-row${selectedDn === n.dn ? ' selected' : ''}`}
              style={{ paddingLeft: 6 + depth * 10 }}
              onClick={() => onSelect(n.dn)}
            >
              <span
                className="tree-twist"
                onClick={(e) => {
                  e.stopPropagation()
                  if (hasKids) setOpen((s) => ({ ...s, [n.id]: !expanded }))
                }}
              >
                {hasKids ? (expanded ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />) : null}
              </span>
              <TypeGlyph type={n.type} />
              <span>{n.name}</span>
            </button>
            {hasKids && expanded ? (
              <TreeRows nodes={n.children} depth={depth + 1} selectedDn={selectedDn} onSelect={onSelect} />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

export function Directory() {
  const { snapshot, selectedId, containerDn, search, select, setContainerDn } = useApp()

  const tree = useMemo(
    () => (snapshot ? buildOuTree(snapshot.nodes, snapshot.baseDn) : []),
    [snapshot]
  )
  const rows = useMemo(() => {
    if (!snapshot) return []
    const q = search.trim().toLowerCase()
    if (q) {
      return snapshot.nodes.filter((n) => {
        const hay = `${n.displayName} ${n.name} ${n.sAMAccountName} ${n.userPrincipalName ?? ''} ${n.description}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return objectsInContainer(snapshot.nodes, containerDn ?? snapshot.baseDn, false)
  }, [snapshot, containerDn, search])

  if (!snapshot) return null

  const containerName = snapshot.nodes.find((n) => n.dn === containerDn)?.displayName ?? snapshot.domain

  return (
    <>
      <div className="split-tree">
        <div className="tree">
          <TreeRows nodes={tree} depth={0} selectedDn={containerDn} onSelect={setContainerDn} />
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
                      <TypeGlyph type={n.type} />
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
