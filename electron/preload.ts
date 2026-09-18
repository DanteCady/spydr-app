import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '../shared/types'
import type { SessionMeta, SessionProfile, SessionView } from './directory/session'

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
  sessionClear: (): Promise<void> => ipcRenderer.invoke('spydr:session:clear')
}

contextBridge.exposeInMainWorld('spydr', api)
