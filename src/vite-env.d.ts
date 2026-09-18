import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '@shared/types'
import type { SessionMeta, SessionProfile, SessionView } from '../electron/directory/session'

export interface SpydrApi {
  windowsPrefill: () => Promise<WindowsPrefill>
  discoverDcs: (domain: string) => Promise<DcRecord[]>
  testConnection: (input: ConnectionInput) => Promise<TestConnectionResult>
  ingest: (input: ConnectionInput) => Promise<DirectorySnapshot>
  sessionPeek: () => Promise<SessionMeta | null>
  sessionRestore: () => Promise<{ snapshot: DirectorySnapshot; view: SessionView } | null>
  sessionSave: (payload: {
    snapshot: DirectorySnapshot
    profile: SessionProfile | null
    view: SessionView
  }) => Promise<void>
  sessionClear: () => Promise<void>
  onMenuCommand: (handler: (command: string) => void) => () => void
  chrome: () => { custom: boolean; platform: string; titleBarHeight: number }
  execRole: (role: string) => Promise<void>
}

export type { SessionMeta, SessionProfile, SessionView }

declare global {
  interface Window {
    spydr?: SpydrApi
  }
}

export {}
