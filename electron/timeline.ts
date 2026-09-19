import { app, safeStorage } from 'electron'
import { chmodSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SnapshotDiff } from '../shared/diff'
import { buildEntry, touchedIds, type EntrySource, type ReadScope, type TimelineEntry } from '../shared/timeline'
import type { DirectorySnapshot } from '../shared/types'

/**
 * The change timeline, in SQLite.
 *
 * Node ships SQLite from 22 onwards and Electron 44 carries Node 24, so this needs no native
 * module — nothing to rebuild per platform, and the Windows cross-build stays intact.
 *
 * Storage is split deliberately. Structure — when, which controller, which scope, how many of what
 * — is stored in the clear so the timeline can be listed and queried by index. The human detail,
 * names and distinguished names and the diff itself, is encrypted with the OS keychain exactly as
 * the session snapshot is. Object GUIDs are indexed in the clear because a GUID on its own says
 * nothing about anybody.
 */

type SqliteModule = typeof import('node:sqlite')
type Database = InstanceType<SqliteModule['DatabaseSync']>

let db: Database | null = null

function file(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'timeline.db')
}

function open(): Database | null {
  if (db) return db
  try {
    const sqlite = process.getBuiltinModule('node:sqlite') as SqliteModule
    const path = file()
    const fresh = !existsSync(path)
    db = new sqlite.DatabaseSync(path)
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS entry (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        read_at TEXT NOT NULL,
        dc_host TEXT NOT NULL,
        base_dn TEXT NOT NULL,
        include_computers INTEGER NOT NULL,
        include_containers INTEGER NOT NULL,
        source TEXT NOT NULL,
        baseline INTEGER NOT NULL,
        objects_added INTEGER NOT NULL,
        objects_removed INTEGER NOT NULL,
        objects_changed INTEGER NOT NULL,
        memberships_added INTEGER NOT NULL,
        memberships_removed INTEGER NOT NULL,
        findings_opened INTEGER NOT NULL,
        findings_closed INTEGER NOT NULL,
        score_before INTEGER NOT NULL,
        score_after INTEGER NOT NULL,
        summary TEXT NOT NULL,
        detail BLOB,
        detail_encrypted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS entry_domain_read_at ON entry (domain, read_at DESC);
      CREATE TABLE IF NOT EXISTS entry_object (
        entry_id TEXT NOT NULL REFERENCES entry (id) ON DELETE CASCADE,
        object_guid TEXT NOT NULL,
        kind TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS entry_object_guid ON entry_object (object_guid);
    `)
    // The file holds directory data; keep it to this user.
    if (fresh) chmodSync(path, 0o600)
    return db
  } catch {
    db = null
    return null
  }
}

function encode(detail: SnapshotDiff): { blob: Buffer; encrypted: boolean } {
  const json = JSON.stringify(detail)
  if (safeStorage.isEncryptionAvailable()) {
    return { blob: safeStorage.encryptString(json), encrypted: true }
  }
  return { blob: Buffer.from(json, 'utf8'), encrypted: false }
}

function decode(blob: unknown, encrypted: boolean): SnapshotDiff | undefined {
  if (!blob) return undefined
  try {
    const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob as Uint8Array)
    const json = encrypted ? safeStorage.decryptString(buffer) : buffer.toString('utf8')
    return JSON.parse(json) as SnapshotDiff
  } catch {
    // Written under a different OS user or keychain; the summary still stands.
    return undefined
  }
}

type Row = Record<string, unknown>

function toEntry(row: Row, detail?: SnapshotDiff): TimelineEntry {
  return {
    id: String(row.id),
    domain: String(row.domain),
    readAt: String(row.read_at),
    dcHost: String(row.dc_host),
    scope: {
      baseDn: String(row.base_dn),
      includeComputers: Number(row.include_computers) === 1,
      includeContainers: Number(row.include_containers) === 1
    },
    source: String(row.source) as EntrySource,
    baseline: Number(row.baseline) === 1,
    counts: {
      objectsAdded: Number(row.objects_added),
      objectsRemoved: Number(row.objects_removed),
      objectsChanged: Number(row.objects_changed),
      membershipsAdded: Number(row.memberships_added),
      membershipsRemoved: Number(row.memberships_removed),
      findingsOpened: Number(row.findings_opened),
      findingsClosed: Number(row.findings_closed)
    },
    scoreBefore: Number(row.score_before),
    scoreAfter: Number(row.score_after),
    summary: String(row.summary),
    detail
  }
}

export interface RecordInput {
  snapshot: DirectorySnapshot
  diff: SnapshotDiff | null
  scope: ReadScope
  source?: EntrySource
}

/** Writes one entry and its object index in a single transaction. */
export function recordRead(input: RecordInput): TimelineEntry | null {
  const database = open()
  if (!database) return null
  const entry = buildEntry({ ...input, id: randomUUID() })
  const { blob, encrypted } = input.diff ? encode(input.diff) : { blob: null, encrypted: false }

  const insertEntry = database.prepare(`
    INSERT INTO entry (
      id, domain, read_at, dc_host, base_dn, include_computers, include_containers, source, baseline,
      objects_added, objects_removed, objects_changed, memberships_added, memberships_removed,
      findings_opened, findings_closed, score_before, score_after, summary, detail, detail_encrypted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertObject = database.prepare('INSERT INTO entry_object (entry_id, object_guid, kind) VALUES (?, ?, ?)')

  database.exec('BEGIN')
  try {
    insertEntry.run(
      entry.id,
      entry.domain,
      entry.readAt,
      entry.dcHost,
      entry.scope.baseDn,
      entry.scope.includeComputers ? 1 : 0,
      entry.scope.includeContainers ? 1 : 0,
      entry.source,
      entry.baseline ? 1 : 0,
      entry.counts.objectsAdded,
      entry.counts.objectsRemoved,
      entry.counts.objectsChanged,
      entry.counts.membershipsAdded,
      entry.counts.membershipsRemoved,
      entry.counts.findingsOpened,
      entry.counts.findingsClosed,
      entry.scoreBefore,
      entry.scoreAfter,
      entry.summary,
      blob,
      encrypted ? 1 : 0
    )
    if (input.diff) {
      const seen = new Set<string>()
      for (const touched of touchedIds(input.diff)) {
        const key = `${touched.id}:${touched.kind}`
        if (seen.has(key)) continue
        seen.add(key)
        insertObject.run(entry.id, touched.id, touched.kind)
      }
    }
    database.exec('COMMIT')
  } catch {
    database.exec('ROLLBACK')
    return null
  }
  return { ...entry, detail: undefined }
}

export function listEntries(domain?: string, limit = 200): TimelineEntry[] {
  const database = open()
  if (!database) return []
  const rows = domain
    ? database.prepare('SELECT * FROM entry WHERE domain = ? ORDER BY read_at DESC LIMIT ?').all(domain, limit)
    : database.prepare('SELECT * FROM entry ORDER BY read_at DESC LIMIT ?').all(limit)
  return (rows as Row[]).map((row) => toEntry(row))
}

export function getEntry(id: string): TimelineEntry | null {
  const database = open()
  if (!database) return null
  const row = database.prepare('SELECT * FROM entry WHERE id = ?').get(id) as Row | undefined
  if (!row) return null
  return toEntry(row, decode(row.detail, Number(row.detail_encrypted) === 1))
}

/** Every entry that touched one object, newest first — the per-object history. */
export function objectHistory(objectGuid: string, limit = 100): { entry: TimelineEntry; kinds: string[] }[] {
  const database = open()
  if (!database) return []
  const rows = database
    .prepare(
      `SELECT e.*, group_concat(o.kind) AS kinds
       FROM entry e JOIN entry_object o ON o.entry_id = e.id
       WHERE o.object_guid = ?
       GROUP BY e.id
       ORDER BY e.read_at DESC
       LIMIT ?`
    )
    .all(objectGuid, limit) as Row[]
  return rows.map((row) => ({ entry: toEntry(row), kinds: String(row.kinds ?? '').split(',').filter(Boolean) }))
}

export function countEntries(): number {
  const database = open()
  if (!database) return 0
  const row = database.prepare('SELECT count(*) AS n FROM entry').get() as Row | undefined
  return row ? Number(row.n) : 0
}

/** Drops entries older than the retention window. Zero days means keep everything. */
export function pruneEntries(retentionDays: number): number {
  const database = open()
  if (!database || retentionDays <= 0) return 0
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString()
  const ids = database.prepare('SELECT id FROM entry WHERE read_at < ?').all(cutoff) as Row[]
  if (ids.length === 0) return 0
  database.exec('BEGIN')
  try {
    const dropObjects = database.prepare('DELETE FROM entry_object WHERE entry_id = ?')
    const dropEntry = database.prepare('DELETE FROM entry WHERE id = ?')
    for (const row of ids) {
      dropObjects.run(String(row.id))
      dropEntry.run(String(row.id))
    }
    database.exec('COMMIT')
  } catch {
    database.exec('ROLLBACK')
    return 0
  }
  return ids.length
}

export function clearTimeline(): void {
  const database = open()
  if (database) {
    try {
      database.exec('DELETE FROM entry_object; DELETE FROM entry; VACUUM;')
      return
    } catch {
      /* fall through to removing the file */
    }
  }
  closeTimeline()
  for (const path of [file(), `${file()}-wal`, `${file()}-shm`]) {
    try {
      rmSync(path, { force: true })
    } catch {
      /* nothing to remove */
    }
  }
}

export function timelinePath(): string {
  return file()
}

export function closeTimeline(): void {
  try {
    db?.close()
  } catch {
    /* already closed */
  }
  db = null
}
