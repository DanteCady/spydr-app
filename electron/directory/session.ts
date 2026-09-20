import { app, safeStorage } from 'electron'
import { gunzipSync, gzipSync } from 'node:zlib'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConnectionInput, DirectorySnapshot, WorkspaceId } from '../../shared/types'

const VERSION = 1

/** Where the user was when the session was saved, so a restore lands in the same place. */
export interface SessionView {
  workspace: WorkspaceId
  selectedId: string | null
  containerDn: string | null
}

/** Everything needed to reconnect except the password, which is never written to disk. */
export interface SessionProfile {
  domain: string
  host: string
  port: number
  protocol: ConnectionInput['protocol']
  bindUsername: string
  baseDn: string
  trustServerCert: boolean
}

/** Small, non-sensitive header so the Connect screen can describe the session without reading it. */
export interface SessionMeta {
  version: number
  savedAt: string
  domain: string
  dcHost?: string
  source: DirectorySnapshot['source']
  stats: DirectorySnapshot['stats']
  profile: SessionProfile | null
  encrypted: boolean
}

function dir(): string {
  const d = join(app.getPath('userData'), 'session')
  if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 })
  return d
}
const metaPath = (): string => join(dir(), 'last-session.json')
const dataPath = (): string => join(dir(), 'last-session.bin')

/** Strip the password: a ConnectionInput must never reach disk intact. */
export function toProfile(input: ConnectionInput): SessionProfile {
  return {
    domain: input.domain,
    host: input.host,
    port: input.port,
    protocol: input.protocol,
    bindUsername: input.bindUsername,
    baseDn: input.baseDn,
    trustServerCert: input.trustServerCert
  }
}

/**
 * The snapshot is a full copy of a directory, so it is compressed and — where the OS provides a
 * keychain — encrypted at rest. Writes go to a temp file first so a crash cannot leave a half
 * written session behind.
 */
export function saveSession(
  snapshot: DirectorySnapshot,
  profile: SessionProfile | null,
  view: SessionView
): void {
  const json = JSON.stringify({ snapshot, view })
  const gz = gzipSync(Buffer.from(json, 'utf8'))
  const encrypted = safeStorage.isEncryptionAvailable()
  const payload = encrypted ? safeStorage.encryptString(gz.toString('base64')) : gz

  const meta: SessionMeta = {
    version: VERSION,
    savedAt: new Date().toISOString(),
    domain: snapshot.domain,
    dcHost: snapshot.dcHost,
    source: snapshot.source,
    stats: snapshot.stats,
    profile,
    encrypted
  }

  const tmp = `${dataPath()}.tmp`
  writeFileSync(tmp, payload, { mode: 0o600 })
  renameSync(tmp, dataPath())
  writeFileSync(metaPath(), JSON.stringify(meta, null, 2), { encoding: 'utf8', mode: 0o600 })
  // mode on writeFileSync only applies when the file is created, and this one is written in place.
  // Earlier builds left it at the umask default, holding the domain, the DC hostname and the bind
  // username in plain text — so tighten it every time rather than only on the first write.
  chmodSync(metaPath(), 0o600)
}

export function loadSessionMeta(): SessionMeta | null {
  try {
    if (!existsSync(metaPath())) return null
    const meta = JSON.parse(readFileSync(metaPath(), 'utf8')) as SessionMeta
    if (meta.version !== VERSION || !existsSync(dataPath())) return null
    return meta
  } catch {
    return null
  }
}

export function loadSession(): { snapshot: DirectorySnapshot; view: SessionView } | null {
  const meta = loadSessionMeta()
  if (!meta) return null
  try {
    const raw = readFileSync(dataPath())
    const gz = meta.encrypted ? Buffer.from(safeStorage.decryptString(raw), 'base64') : raw
    return JSON.parse(gunzipSync(gz).toString('utf8')) as { snapshot: DirectorySnapshot; view: SessionView }
  } catch {
    // A session written under a different OS user or keychain cannot be read back; drop it
    // rather than leaving a restore option that always fails.
    clearSession()
    return null
  }
}

export function clearSession(): void {
  for (const p of [metaPath(), dataPath(), `${dataPath()}.tmp`]) {
    try {
      rmSync(p, { force: true })
    } catch {
      /* nothing to clean up */
    }
  }
}
