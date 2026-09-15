import type { ConnectionInput, DcRecord, DirectorySnapshot, TestConnectionResult, WindowsPrefill } from '@shared/types'

export interface SpydrApi {
  windowsPrefill: () => Promise<WindowsPrefill>
  discoverDcs: (domain: string) => Promise<DcRecord[]>
  testConnection: (input: ConnectionInput) => Promise<TestConnectionResult>
  ingest: (input: ConnectionInput) => Promise<DirectorySnapshot>
}

declare global {
  interface Window {
    spydr?: SpydrApi
  }
}

export {}
