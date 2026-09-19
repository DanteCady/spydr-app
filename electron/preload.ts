import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '../shared/types'
import type { SessionMeta, SessionView } from './directory/session'
import type { ReportResult } from './report'
import type { AboutInfo, AppSettings, SettingsPatch } from '../shared/settings'
import type { TimelineEntry } from '../shared/timeline'
import type { UpdateCheck } from './updates'

const api = {
  windowsPrefill: (): Promise<WindowsPrefill> => ipcRenderer.invoke('spydr:prefill'),
  discoverDcs: (domain: string): Promise<DcRecord[]> => ipcRenderer.invoke('spydr:discover', domain),
  testConnection: (input: ConnectionInput): Promise<TestConnectionResult> => ipcRenderer.invoke('spydr:test', input),
  ingest: (input: ConnectionInput): Promise<DirectorySnapshot> => ipcRenderer.invoke('spydr:ingest', input),
  /** Re-read the directory with the credentials main is already holding. */
  refresh: (): Promise<DirectorySnapshot> => ipcRenderer.invoke('spydr:refresh'),
  canRefresh: (): boolean => ipcRenderer.sendSync('spydr:can-refresh'),
  forgetBind: (): Promise<void> => ipcRenderer.invoke('spydr:forget-bind'),
  sessionPeek: (): Promise<SessionMeta | null> => ipcRenderer.invoke('spydr:session:peek'),
  sessionRestore: (): Promise<{ snapshot: DirectorySnapshot; view: SessionView } | null> =>
    ipcRenderer.invoke('spydr:session:restore'),
  sessionSave: (payload: { snapshot: DirectorySnapshot; view: SessionView }): Promise<void> =>
    ipcRenderer.invoke('spydr:session:save', payload),
  sessionClear: (): Promise<void> => ipcRenderer.invoke('spydr:session:clear'),
  /** Writes a PDF of the current findings; resolves null when the user cancels the save dialog. */
  report: (snapshot: DirectorySnapshot): Promise<ReportResult | null> => ipcRenderer.invoke('spydr:report', snapshot),
  /** Settings. The first read is synchronous so the first paint already has the right theme. */
  settingsSync: (): AppSettings => ipcRenderer.sendSync('spydr:settings:sync'),
  setSettings: (patch: SettingsPatch): Promise<AppSettings> => ipcRenderer.invoke('spydr:settings:set', patch),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('spydr:settings:reset'),
  onSettings: (handler: (settings: AppSettings) => void): (() => void) => {
    const listener = (_evt: unknown, settings: AppSettings): void => handler(settings)
    ipcRenderer.on('spydr:settings', listener)
    return () => { ipcRenderer.removeListener('spydr:settings', listener) }
  },
  about: (): Promise<AboutInfo> => ipcRenderer.invoke('spydr:about'),
  /** The change timeline. List results carry no detail; get() decrypts one entry. */
  timelineList: (domain?: string): Promise<TimelineEntry[]> => ipcRenderer.invoke('spydr:timeline:list', domain),
  timelineGet: (id: string): Promise<TimelineEntry | null> => ipcRenderer.invoke('spydr:timeline:get', id),
  timelineObject: (objectGuid: string): Promise<{ entry: TimelineEntry; kinds: string[] }[]> =>
    ipcRenderer.invoke('spydr:timeline:object', objectGuid),
  timelineClear: (): Promise<void> => ipcRenderer.invoke('spydr:timeline:clear'),
  /** Invented history for the sample domain, so the Timeline has something to demonstrate. */
  timelineSample: (): Promise<{ created: number; replaced: number }> => ipcRenderer.invoke('spydr:timeline:sample'),
  timelineStats: (): Promise<{ entries: number; path: string }> => ipcRenderer.invoke('spydr:timeline:stats'),
  checkForUpdate: (): Promise<UpdateCheck> => ipcRenderer.invoke('spydr:updates:check'),
  /** Subscribe to menu commands; returns an unsubscribe. */
  /** Chrome the renderer must draw itself, and the editing actions the OS performs for us. */
  chrome: (): { custom: boolean; platform: string; titleBarHeight: number } =>
    ipcRenderer.sendSync('spydr:chrome'),
  execRole: (role: string): Promise<void> => ipcRenderer.invoke('spydr:role', role),
  onMenuCommand: (handler: (command: string) => void): (() => void) => {
    const listener = (_evt: unknown, command: string): void => handler(command)
    ipcRenderer.on('spydr:menu', listener)
    return () => { ipcRenderer.removeListener('spydr:menu', listener) }
  }
}

contextBridge.exposeInMainWorld('spydr', api)
