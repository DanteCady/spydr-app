import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '@shared/types'
import type { SessionMeta, SessionProfile, SessionView } from '../electron/directory/session'
import type { ReportResult } from '../electron/report'

export interface SpydrApi {
  windowsPrefill: () => Promise<WindowsPrefill>
  discoverDcs: (domain: string) => Promise<DcRecord[]>
  testConnection: (input: ConnectionInput) => Promise<TestConnectionResult>
  ingest: (input: ConnectionInput) => Promise<DirectorySnapshot>
  sessionPeek: () => Promise<SessionMeta | null>
  sessionRestore: () => Promise<{ snapshot: DirectorySnapshot; view: SessionView } | null>
  sessionSave: (payload: { snapshot: DirectorySnapshot; view: SessionView }) => Promise<void>
  sessionClear: () => Promise<void>
  report: (snapshot: DirectorySnapshot) => Promise<ReportResult | null>
  onMenuCommand: (handler: (command: string) => void) => () => void
  chrome: () => { custom: boolean; platform: string; titleBarHeight: number }
  execRole: (role: string) => Promise<void>
}

export type { ReportResult, SessionMeta, SessionProfile, SessionView }

declare global {
  interface Window {
    spydr?: SpydrApi
  }
}

export {}
