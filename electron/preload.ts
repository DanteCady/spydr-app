import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '../shared/types'

const api = {
  windowsPrefill: (): Promise<WindowsPrefill> => ipcRenderer.invoke('spydr:prefill'),
  discoverDcs: (domain: string): Promise<DcRecord[]> => ipcRenderer.invoke('spydr:discover', domain),
  testConnection: (input: ConnectionInput): Promise<TestConnectionResult> => ipcRenderer.invoke('spydr:test', input),
  ingest: (input: ConnectionInput): Promise<DirectorySnapshot> => ipcRenderer.invoke('spydr:ingest', input)
}

contextBridge.exposeInMainWorld('spydr', api)
