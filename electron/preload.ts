import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '../shared/types'
import type { SessionMeta, SessionView } from './directory/session'
import type { ReportResult } from './report'
import type { AboutInfo, AppSettings, SettingsPatch } from '../shared/settings'
import type { TimelineEntry } from '../shared/timeline'
import type { LicenceState } from '../shared/license'
import type { TelemetryPayload } from '../shared/telemetry'
import type { UpdateCheck } from './updates'

const api = {
  windowsPrefill: (): Promise<WindowsPrefill> => ipcRenderer.invoke('spydir:prefill'),
  discoverDcs: (domain: string): Promise<DcRecord[]> => ipcRenderer.invoke('spydir:discover', domain),
  testConnection: (input: ConnectionInput): Promise<TestConnectionResult> => ipcRenderer.invoke('spydir:test', input),
  ingest: (input: ConnectionInput): Promise<DirectorySnapshot> => ipcRenderer.invoke('spydir:ingest', input),
  /** Re-read the directory with the credentials main is already holding. */
  refresh: (): Promise<DirectorySnapshot> => ipcRenderer.invoke('spydir:refresh'),
  canRefresh: (): boolean => ipcRenderer.sendSync('spydir:can-refresh'),
  forgetBind: (): Promise<void> => ipcRenderer.invoke('spydir:forget-bind'),
  sessionPeek: (): Promise<SessionMeta | null> => ipcRenderer.invoke('spydir:session:peek'),
  sessionRestore: (): Promise<{ snapshot: DirectorySnapshot; view: SessionView } | null> =>
    ipcRenderer.invoke('spydir:session:restore'),
  sessionSave: (payload: { snapshot: DirectorySnapshot; view: SessionView }): Promise<void> =>
    ipcRenderer.invoke('spydir:session:save', payload),
  sessionClear: (): Promise<void> => ipcRenderer.invoke('spydir:session:clear'),
  /** Writes a PDF of the current findings; resolves null when the user cancels the save dialog. */
  report: (snapshot: DirectorySnapshot): Promise<ReportResult | null> => ipcRenderer.invoke('spydir:report', snapshot),
  /** Settings. The first read is synchronous so the first paint already has the right theme. */
  settingsSync: (): AppSettings => ipcRenderer.sendSync('spydir:settings:sync'),
  setSettings: (patch: SettingsPatch): Promise<AppSettings> => ipcRenderer.invoke('spydir:settings:set', patch),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('spydir:settings:reset'),
  onSettings: (handler: (settings: AppSettings) => void): (() => void) => {
    const listener = (_evt: unknown, settings: AppSettings): void => handler(settings)
    ipcRenderer.on('spydir:settings', listener)
    return () => { ipcRenderer.removeListener('spydir:settings', listener) }
  },
  about: (): Promise<AboutInfo> => ipcRenderer.invoke('spydir:about'),
  /** Exactly what a usage report would contain, built by the same code that sends one. */
  telemetryPreview: (): Promise<TelemetryPayload> => ipcRenderer.invoke('spydir:telemetry:preview'),
  telemetrySend: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('spydir:telemetry:send'),
  noteWorkspace: (workspace: string): void => ipcRenderer.send('spydir:telemetry:workspace', workspace),
  licence: (): Promise<LicenceState> => ipcRenderer.invoke('spydir:licence:state'),
  /** Activation. The key never reaches the renderer again once it is stored; only a masked hint. */
  activate: (key: string): Promise<LicenceState> => ipcRenderer.invoke('spydir:licence:activate', key),
  deactivate: (): Promise<LicenceState> => ipcRenderer.invoke('spydir:licence:deactivate'),
  /** The change timeline. List results carry no detail; get() decrypts one entry. */
  timelineList: (domain?: string): Promise<TimelineEntry[]> => ipcRenderer.invoke('spydir:timeline:list', domain),
  timelineGet: (id: string): Promise<TimelineEntry | null> => ipcRenderer.invoke('spydir:timeline:get', id),
  timelineObject: (objectGuid: string): Promise<{ entry: TimelineEntry; kinds: string[] }[]> =>
    ipcRenderer.invoke('spydir:timeline:object', objectGuid),
  timelineClear: (): Promise<void> => ipcRenderer.invoke('spydir:timeline:clear'),
  /** Invented history for the sample domain, so the Timeline has something to demonstrate. */
  timelineSample: (): Promise<{ created: number; replaced: number }> => ipcRenderer.invoke('spydir:timeline:sample'),
  timelineStats: (): Promise<{ entries: number; path: string }> => ipcRenderer.invoke('spydir:timeline:stats'),
  checkForUpdate: (): Promise<UpdateCheck> => ipcRenderer.invoke('spydir:updates:check'),
  downloadUpdate: (): Promise<UpdateCheck> => ipcRenderer.invoke('spydir:updates:download'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('spydir:updates:install'),
  updateState: (): UpdateCheck => ipcRenderer.sendSync('spydir:updates:state'),
  // Progress and state changes arrive while a download runs, so the screen follows it live.
  onUpdate: (handler: (state: UpdateCheck) => void): (() => void) => {
    const listener = (_evt: unknown, state: UpdateCheck): void => handler(state)
    ipcRenderer.on('spydir:updates:state', listener)
    return () => ipcRenderer.removeListener('spydir:updates:state', listener)
  },
  /** Chrome the renderer must draw itself, and the editing actions the OS performs for us. */
  chrome: (): { custom: boolean; platform: string; titleBarHeight: number } =>
    ipcRenderer.sendSync('spydir:chrome'),
  execRole: (role: string): Promise<void> => ipcRenderer.invoke('spydir:role', role),
  /** Subscribe to menu commands; returns an unsubscribe. */
  onMenuCommand: (handler: (command: string) => void): (() => void) => {
    const listener = (_evt: unknown, command: string): void => handler(command)
    ipcRenderer.on('spydir:menu', listener)
    return () => { ipcRenderer.removeListener('spydir:menu', listener) }
  }
}

contextBridge.exposeInMainWorld('spydir', api)
