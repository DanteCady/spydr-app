import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { buildMembershipGraph, enumeratePaths } from '@shared/graph'
import type { ConnectionInput, DirectorySnapshot, Finding, PathResult, WorkspaceId } from '@shared/types'

interface AppState {
  snapshot: DirectorySnapshot | null
  workspace: WorkspaceId
  selectedId: string | null
  containerDn: string | null
  search: string
  pathSource: string
  pathTarget: string
  openSample: () => void
  ingestLdap: (input: ConnectionInput) => Promise<void>
  disconnect: () => void
  setWorkspace: (w: WorkspaceId) => void
  select: (id: string | null) => void
  setContainerDn: (dn: string | null) => void
  setSearch: (q: string) => void
  setPathSource: (id: string) => void
  setPathTarget: (id: string) => void
  goTo: (workspace: WorkspaceId, objectId?: string) => void
  goToFinding: (finding: Finding) => void
  activeFinding: Finding | null
  paths: PathResult[]
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<DirectorySnapshot | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceId>('directory')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [containerDn, setContainerDn] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pathSource, setPathSource] = useState('')
  const [pathTarget, setPathTarget] = useState('')
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null)

  const graph = useMemo(
    () => (snapshot ? buildMembershipGraph(snapshot.nodes, snapshot.edges) : null),
    [snapshot]
  )

  const paths = useMemo(() => {
    if (!graph || !pathSource || !pathTarget) return []
    return enumeratePaths(graph, pathSource, pathTarget)
  }, [graph, pathSource, pathTarget])

  const applySnapshot = useCallback((s: DirectorySnapshot) => {
    setSnapshot(s)
    setWorkspace('directory')
    setContainerDn(s.baseDn)
    setSelectedId(null)
    setSearch('')
    setActiveFinding(null)
    const user = s.nodes.find((n) => n.type === 'user')
    const da = s.nodes.find((n) => n.sAMAccountName.toLowerCase() === 'domain admins')
    setPathSource(s.nodes.find((n) => n.id === 'user-alice')?.id ?? user?.id ?? '')
    setPathTarget(da?.id ?? '')
  }, [])

  const openSample = useCallback(() => {
    applySnapshot(loadContosoFixture())
  }, [applySnapshot])

  const ingestLdap = useCallback(
    async (input: ConnectionInput) => {
      if (!window.spydr?.ingest) {
        throw new Error('Run Spydr as the desktop app to bind to Active Directory.')
      }
      const s = await window.spydr.ingest(input)
      applySnapshot(s)
    },
    [applySnapshot]
  )

  const disconnect = useCallback(() => {
    setSnapshot(null)
    setSelectedId(null)
    setSearch('')
    setActiveFinding(null)
  }, [])

  const goTo = useCallback((w: WorkspaceId, objectId?: string) => {
    if (objectId) {
      setSelectedId(objectId)
      setSnapshot((current) => {
        const node = current?.nodes.find((n) => n.id === objectId)
        if (node?.parentDn) setContainerDn(node.parentDn)
        return current
      })
    }
    setWorkspace(w)
  }, [])

  const goToFinding = useCallback((finding: Finding) => {
    setActiveFinding(finding)
    setSnapshot((current) => {
      if (!current) return current
      const byId = new Map(current.nodes.map((n) => [n.id, n]))
      const objects = finding.objectIds.map((id) => byId.get(id)).filter(Boolean)
      const user = objects.find((n) => n?.type === 'user')
      const priv = objects.find((n) => n?.type === 'group' && n.privileged)
      const groups = objects.filter((n) => n?.type === 'group')

      if (finding.type === 'privileged-nested-path' || finding.type === 'redundant-membership') {
        if (user) setPathSource(user.id)
        const target = priv ?? groups[groups.length - 1]
        if (target) setPathTarget(target.id)
        if (user?.parentDn) setContainerDn(user.parentDn)
        if (user) setSelectedId(user.id)
        setWorkspace('pathfinder')
        return current
      }

      if (
        finding.type === 'circular-nesting' ||
        finding.type === 'deep-nesting' ||
        finding.type === 'distribution-in-security'
      ) {
        const focus = objects[0]
        if (focus) {
          setSelectedId(focus.id)
          if (focus.parentDn) setContainerDn(focus.parentDn)
        }
        setWorkspace('web')
        return current
      }

      const focus = objects[0]
      if (focus) {
        setSelectedId(focus.id)
        if (focus.parentDn) setContainerDn(focus.parentDn)
      }
      setWorkspace('directory')
      return current
    })
  }, [])

  const value: AppState = {
    snapshot,
    workspace,
    selectedId,
    containerDn,
    search,
    pathSource,
    pathTarget,
    openSample,
    ingestLdap,
    disconnect,
    setWorkspace,
    select: setSelectedId,
    setContainerDn,
    setSearch,
    setPathSource,
    setPathTarget,
    goTo,
    goToFinding,
    activeFinding,
    paths
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
