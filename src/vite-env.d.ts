/// <reference types="vite/client" />

import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '@shared/types'
import type { SessionMeta, SessionProfile, SessionView } from '../electron/directory/session'
import type { ReportResult } from '../electron/report'
import type { AboutInfo, AppSettings, SettingsPatch } from '@shared/settings'
import type { TimelineEntry } from '@shared/timeline'
import type { LicenceState } from '@shared/license'
import type { TelemetryPayload } from '@shared/telemetry'
import type { UpdateCheck } from '../electron/updates'

export interface SpydirApi {
  windowsPrefill: () => Promise<WindowsPrefill>
  discoverDcs: (domain: string) => Promise<DcRecord[]>
  testConnection: (input: ConnectionInput) => Promise<TestConnectionResult>
  ingest: (input: ConnectionInput) => Promise<DirectorySnapshot>
  refresh: () => Promise<DirectorySnapshot>
  canRefresh: () => boolean
  forgetBind: () => Promise<void>
  sessionPeek: () => Promise<SessionMeta | null>
  sessionRestore: () => Promise<{ snapshot: DirectorySnapshot; view: SessionView } | null>
  sessionSave: (payload: { snapshot: DirectorySnapshot; view: SessionView }) => Promise<void>
  sessionClear: () => Promise<void>
  report: (snapshot: DirectorySnapshot) => Promise<ReportResult | null>
  settingsSync: () => AppSettings
  setSettings: (patch: SettingsPatch) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  onSettings: (handler: (settings: AppSettings) => void) => () => void
  about: () => Promise<AboutInfo>
  telemetryPreview: () => Promise<TelemetryPayload>
  telemetrySend: () => Promise<{ ok: boolean; message: string }>
  noteWorkspace: (workspace: string) => void
  licence: () => Promise<LicenceState>
  activate: (key: string) => Promise<LicenceState>
  deactivate: () => Promise<LicenceState>
  timelineList: (domain?: string) => Promise<TimelineEntry[]>
  timelineGet: (id: string) => Promise<TimelineEntry | null>
  timelineObject: (objectGuid: string) => Promise<{ entry: TimelineEntry; kinds: string[] }[]>
  timelineClear: () => Promise<void>
  timelineSample: () => Promise<{ created: number; replaced: number }>
  timelineStats: () => Promise<{ entries: number; path: string }>
  checkForUpdate: () => Promise<UpdateCheck>
  onMenuCommand: (handler: (command: string) => void) => () => void
  chrome: () => { custom: boolean; platform: string; titleBarHeight: number }
  execRole: (role: string) => Promise<void>
}

export type { ReportResult, SessionMeta, SessionProfile, SessionView, UpdateCheck }

declare global {
  interface Window {
    spydir?: SpydirApi
  }
}

export {}
