import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TypeGlyph } from '../components/TypeGlyph'
import { StatusBadges } from '../components/StatusBadges'
import { relativeTime, typeLabel } from '../lib/format'
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
  const {
    snapshot,
    selectedId,
    containerDn,
    search,
    select,
    setContainerDn,
    refreshDirectory,
    canRefresh,
    refreshing,
    refreshStatus
  } = useApp()
  const [showSystem, setShowSystem] = useState(false)
  // undefined = follow the default (expanded); a boolean is an explicit user choice.
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const contains = useMemo(() => (snapshot ? dominantChildType(snapshot.nodes) : new Map()), [snapshot])
  // What the toggle hides. The sample has none at all, which made the control look broken.
  const systemCount = useMemo(
    () => (snapshot ? snapshot.nodes.filter((n) => isSystemContainer(n, snapshot.baseDn)).length : 0),
    [snapshot]
  )
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
          <button type="button" className="tb-btn icon" title="Expand all" aria-label="Expand all" onClick={() => setAll(true)}>
            <ChevronsUpDown size={14} aria-hidden />
          </button>
          <button type="button" className="tb-btn icon" title="Collapse all" aria-label="Collapse all" onClick={() => setAll(false)}>
            <ChevronsDownUp size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={showSystem ? 'tb-btn active' : 'tb-btn'}
            aria-pressed={showSystem}
            disabled={systemCount === 0}
            title={
              systemCount === 0
                ? 'This directory has no internal containers to show — nothing is being hidden'
                : showSystem
                  ? `Hide the ${systemCount} container${systemCount === 1 ? '' : 's'} Active Directory maintains for itself`
                  : `Show the ${systemCount} container${systemCount === 1 ? '' : 's'} Active Directory maintains for itself, such as System, Program Data and NTDS Quotas`
            }
            onClick={() => setShowSystem((on) => !on)}
          >
            {showSystem ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
            <span>AD internals{systemCount > 0 ? ` (${systemCount})` : ''}</span>
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
          <span className="head-right">
            <span className="muted">Read {relativeTime(snapshot.ingestedAt)}</span>
            {/* Always present, so the feature is discoverable, and disabled with the reason when
                it cannot run. A control that vanishes teaches nobody it exists. */}
            <button
              type="button"
              className="tb-btn"
              onClick={() => void refreshDirectory()}
              disabled={!canRefresh || refreshing}
              title={
                snapshot.source === 'fixture'
                  ? 'Re-crawl reads a live domain controller. This is the sample directory, which never changes.'
                  : canRefresh
                    ? 'Read the directory again and show what changed'
                    : 'Connect to the directory again to re-crawl — credentials are held for the session only, not across restarts'
              }
            >
              <RefreshCw size={13} className={refreshing ? 'spin' : undefined} aria-hidden />
              {refreshing ? 'Reading…' : 'Re-crawl'}
            </button>
            <span>{rows.length} objects</span>
          </span>
        </div>
        {refreshStatus ? <div className="refresh-status">{refreshStatus}</div> : null}
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
