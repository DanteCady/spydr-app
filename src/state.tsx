import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { buildMembershipGraph, enumeratePaths } from '@shared/graph'
import type { ConnectionInput, DirectorySnapshot, Finding, PathResult, WorkspaceId } from '@shared/types'
import type { SessionMeta } from './vite-env'

export type Theme = 'dark' | 'light' | 'vivid'

/** Whether the user has agreed to SPYDR keeping a copy of a live directory on this computer. */
export type SessionConsent = 'yes' | 'no' | 'unset'

export const THEMES: Theme[] = ['dark', 'light', 'vivid']

interface AppState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
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
  clearFinding: () => void
  activeFinding: Finding | null
  paths: PathResult[]
  /** Header of the session on disk, or null when there is nothing to restore. */
  savedSession: SessionMeta | null
  restoreSession: () => Promise<void>
  forgetSession: () => Promise<void>
  sessionConsent: SessionConsent
  setSessionConsent: (consent: 'yes' | 'no') => void
  /** True while a live directory is open and the question has not been answered yet. */
  needsSessionConsent: boolean
  /** PDF report of the current findings. Status doubles as the error channel. */
  generateReport: () => Promise<void>
  reportBusy: boolean
  reportStatus: string | null
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
  const [savedSession, setSavedSession] = useState<SessionMeta | null>(null)
  const [sessionConsent, setConsent] = useState<SessionConsent>(() => {
    const saved = window.localStorage.getItem('spydr-session-consent')
    return saved === 'yes' || saved === 'no' ? saved : 'unset'
  })
  const [reportBusy, setReportBusy] = useState(false)
  const [reportStatus, setReportStatus] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem('spydr-theme')
    return THEMES.includes(saved as Theme) ? (saved as Theme) : 'dark'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('spydr-theme', theme)
  }, [theme])

  useEffect(() => {
    void window.spydr?.sessionPeek().then(setSavedSession)
  }, [])

  const graph = useMemo(
    () => (snapshot ? buildMembershipGraph(snapshot.nodes, snapshot.edges) : null),
    [snapshot]
  )

  const paths = useMemo(() => {
    if (!graph || !pathSource || !pathTarget) return []
    return enumeratePaths(graph, pathSource, pathTarget)
  }, [graph, pathSource, pathTarget])

  const applySnapshot = useCallback((s: DirectorySnapshot, view?: { workspace: WorkspaceId; selectedId: string | null; containerDn: string | null }) => {
    setSnapshot(s)
    setWorkspace(view?.workspace ?? 'directory')
    setContainerDn(view?.containerDn ?? s.baseDn)
    setSelectedId(view?.selectedId ?? null)
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
        throw new Error('Run SPYDR as the desktop app to bind to Active Directory.')
      }
      const s = await window.spydr.ingest(input)
      applySnapshot(s)
    },
    [applySnapshot]
  )

  // Disconnecting clears the view but deliberately leaves the saved session in place, so it can
  // still be restored. Forgetting it is a separate, explicit action.
  const disconnect = useCallback(() => {
    setSnapshot(null)
    setSelectedId(null)
    setSearch('')
    setActiveFinding(null)
    void window.spydr?.sessionPeek().then(setSavedSession)
  }, [])

  const restoreSession = useCallback(async () => {
    const saved = await window.spydr?.sessionRestore()
    if (!saved) {
      setSavedSession(null)
      return
    }
    applySnapshot(saved.snapshot, saved.view)
  }, [applySnapshot])

  const forgetSession = useCallback(async () => {
    await window.spydr?.sessionClear()
    setSavedSession(null)
  }, [])

  const setSessionConsent = useCallback((consent: 'yes' | 'no') => {
    setConsent(consent)
    window.localStorage.setItem('spydr-session-consent', consent)
    // Declining is retroactive: anything already written is removed, not just left in place.
    if (consent === 'no') void forgetSession()
  }, [forgetSession])

  const generateReport = useCallback(async () => {
    if (!snapshot) return
    if (!window.spydr?.report) {
      setReportStatus('Run SPYDR as the desktop app to generate a report.')
      return
    }
    setReportBusy(true)
    setReportStatus(null)
    try {
      const result = await window.spydr.report(snapshot)
      setReportStatus(result ? `Saved ${result.pages} pages to ${result.path}` : null)
    } catch (err) {
      setReportStatus(err instanceof Error ? err.message : 'Could not write the report.')
    } finally {
      setReportBusy(false)
    }
  }, [snapshot])

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

  // Persist whenever the snapshot or the user's place in it changes. Debounced so that clicking
  // through the tree does not rewrite a large directory on every selection. A real directory is
  // only written once the user has said it may be; the sample carries nobody's data, so it is
  // always restorable.
  useEffect(() => {
    if (!snapshot || !window.spydr?.sessionSave) return
    if (snapshot.source === 'ldap' && sessionConsent !== 'yes') return
    const id = window.setTimeout(() => {
      void window.spydr
        ?.sessionSave({ snapshot, view: { workspace, selectedId, containerDn } })
        .then(() => window.spydr?.sessionPeek().then(setSavedSession))
    }, 600)
    return () => window.clearTimeout(id)
  }, [snapshot, workspace, selectedId, containerDn, sessionConsent])

  const value: AppState = {
    theme,
    toggleTheme: useCallback(() => setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]), []),
    setTheme,
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
    clearFinding: useCallback(() => setActiveFinding(null), []),
    activeFinding,
    paths,
    savedSession,
    restoreSession,
    forgetSession,
    sessionConsent,
    setSessionConsent,
    needsSessionConsent: !!snapshot && snapshot.source === 'ldap' && sessionConsent === 'unset',
    generateReport,
    reportBusy,
    reportStatus
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
