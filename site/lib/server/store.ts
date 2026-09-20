import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Licences, activations and telemetry, in SQLite on the instance.
 *
 * Node ships SQLite from 22, so this needs no native module on the Lightsail box either. The file
 * lives wherever LICENSE_DB points, defaulting to ./data/spydr.db.
 */

type SqliteModule = typeof import('node:sqlite')
type Database = InstanceType<SqliteModule['DatabaseSync']>

let db: Database | null = null

export function store(): Database {
  if (db) return db
  const path = process.env.LICENSE_DB ?? './data/spydr.db'
  const dir = dirname(path)
  // This file holds every registered address and a decryptable licence key for each one. The
  // directory is owner-only, and so is the database and the two files WAL mode keeps beside it.
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })

  const sqlite = process.getBuiltinModule('node:sqlite') as SqliteModule
  db = new sqlite.DatabaseSync(path)
  for (const f of [path, `${path}-wal`, `${path}-shm`]) {
    try {
      if (existsSync(f)) chmodSync(f, 0o600)
    } catch {
      // Windows and some mounts do not do modes. The path matters more than the bit.
    }
  }
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS licence (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      tier TEXT NOT NULL DEFAULT 'free',
      features TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      expires_at TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS licence_email ON licence (email);
    -- One live key per address, enforced by the database rather than by remembering to check.
    CREATE UNIQUE INDEX IF NOT EXISTS licence_email_live ON licence (email) WHERE revoked = 0;
    CREATE TABLE IF NOT EXISTS activation (
      licence_id TEXT NOT NULL REFERENCES licence (id),
      machine TEXT NOT NULL,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      version TEXT,
      os TEXT,
      count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (licence_id, machine)
    );
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at TEXT NOT NULL,
      install TEXT NOT NULL,
      version TEXT,
      os TEXT,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS telemetry_install ON telemetry (install, received_at);
  `)
  // Added after the first release: keys are kept encrypted so a lost one can be re-sent.
  const columns = db.prepare('PRAGMA table_info(licence)').all() as { name: string }[]
  if (!columns.some((c) => c.name === 'key_enc')) {
    db.exec('ALTER TABLE licence ADD COLUMN key_enc TEXT')
  }

  return db
}

/**
 * A fixed window per key, held in memory.
 *
 * Two things keep this honest. Expired buckets are swept, because the map is keyed by something
 * the caller influences and an unswept map is just a slower way of running out of memory. And the
 * map is capped, because a sweep only helps if entries actually expire faster than they arrive —
 * past the cap, new keys are refused rather than admitted, which fails toward "too strict".
 */
const hits = new Map<string, { count: number; resetAt: number }>()
const MAX_BUCKETS = 50_000
let lastSweep = 0

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, entry] of hits) if (now > entry.resetAt) hits.delete(key)
}

export function rateLimit(bucket: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  sweep(now)

  const found = hits.get(bucket)
  if (found && now <= found.resetAt) {
    if (found.count >= limit) return false
    found.count += 1
    return true
  }

  // A bucket we are not already tracking costs memory, so past the cap it is refused outright.
  if (!found && hits.size >= MAX_BUCKETS) return false
  hits.set(bucket, { count: 1, resetAt: now + windowMs })
  return true
}

/**
 * A ceiling on the whole instance, not just on one caller.
 *
 * Per-identifier limits answer "how much can one person do"; they cannot answer "how much can the
 * internet do", which is the question that decides whether the disk fills. This counts real rows
 * in a real window, so it survives a restart in a way the in-memory limiter cannot.
 */
export function underGlobalCap(what: 'licences' | 'telemetry', limit: number, windowMs: number): boolean {
  // Whole statements rather than an interpolated table name: nothing in this file builds SQL from
  // a string, and that property is worth more than the duplication.
  const sql =
    what === 'licences'
      ? 'SELECT COUNT(*) AS n FROM licence WHERE created_at >= ?'
      : 'SELECT COUNT(*) AS n FROM telemetry WHERE received_at >= ?'
  const since = new Date(Date.now() - windowMs).toISOString()
  const row = store().prepare(sql).get(since) as { n: number } | undefined
  return (row?.n ?? 0) < limit
}
