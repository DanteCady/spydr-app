import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '../shared/types'
import type { SessionMeta, SessionProfile, SessionView } from './directory/session'
import type { ReportResult } from './report'

const api = {
  windowsPrefill: (): Promise<WindowsPrefill> => ipcRenderer.invoke('spydr:prefill'),
  discoverDcs: (domain: string): Promise<DcRecord[]> => ipcRenderer.invoke('spydr:discover', domain),
  testConnection: (input: ConnectionInput): Promise<TestConnectionResult> => ipcRenderer.invoke('spydr:test', input),
  ingest: (input: ConnectionInput): Promise<DirectorySnapshot> => ipcRenderer.invoke('spydr:ingest', input),
  sessionPeek: (): Promise<SessionMeta | null> => ipcRenderer.invoke('spydr:session:peek'),
  sessionRestore: (): Promise<{ snapshot: DirectorySnapshot; view: SessionView } | null> =>
    ipcRenderer.invoke('spydr:session:restore'),
  sessionSave: (payload: {
    snapshot: DirectorySnapshot
    profile: SessionProfile | null
    view: SessionView
  }): Promise<void> => ipcRenderer.invoke('spydr:session:save', payload),
  sessionClear: (): Promise<void> => ipcRenderer.invoke('spydr:session:clear'),
  /** Writes a PDF of the current findings; resolves null when the user cancels the save dialog. */
  report: (snapshot: DirectorySnapshot): Promise<ReportResult | null> => ipcRenderer.invoke('spydr:report', snapshot),
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
