import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { buildMembershipGraph, enumeratePaths } from '@shared/graph'
import type { DirectorySnapshot, PathResult, WorkspaceId } from '@shared/types'

interface AppState {
  snapshot: DirectorySnapshot | null
  workspace: WorkspaceId
  selectedId: string | null
  containerDn: string | null
  search: string
  webShowUsers: boolean
  pathSource: string
  pathTarget: string
  openSample: () => void
  disconnect: () => void
  setWorkspace: (w: WorkspaceId) => void
  select: (id: string | null) => void
  setContainerDn: (dn: string | null) => void
  setSearch: (q: string) => void
  setWebShowUsers: (v: boolean) => void
  setPathSource: (id: string) => void
  setPathTarget: (id: string) => void
  goTo: (workspace: WorkspaceId, objectId?: string) => void
  paths: PathResult[]
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<DirectorySnapshot | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceId>('directory')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [containerDn, setContainerDn] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [webShowUsers, setWebShowUsers] = useState(false)
  const [pathSource, setPathSource] = useState('')
  const [pathTarget, setPathTarget] = useState('')

  const graph = useMemo(
    () => (snapshot ? buildMembershipGraph(snapshot.nodes, snapshot.edges) : null),
    [snapshot]
  )

  const paths = useMemo(() => {
    if (!graph || !pathSource || !pathTarget) return []
    return enumeratePaths(graph, pathSource, pathTarget)
  }, [graph, pathSource, pathTarget])

  const openSample = useCallback(() => {
    const s = loadContosoFixture()
    setSnapshot(s)
    setWorkspace('directory')
    setContainerDn(s.baseDn)
    setSelectedId(null)
    setSearch('')
    setWebShowUsers(false)
    setPathSource(s.nodes.find((n) => n.id === 'user-alice')?.id ?? '')
    setPathTarget(s.nodes.find((n) => n.id === 'g-da')?.id ?? '')
  }, [])

  const disconnect = useCallback(() => {
    setSnapshot(null)
    setSelectedId(null)
    setSearch('')
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

  const value: AppState = {
    snapshot,
    workspace,
    selectedId,
    containerDn,
    search,
    webShowUsers,
    pathSource,
    pathTarget,
    openSample,
    disconnect,
    setWorkspace,
    select: setSelectedId,
    setContainerDn,
    setSearch,
    setWebShowUsers,
    setPathSource,
    setPathTarget,
    goTo,
    paths
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
