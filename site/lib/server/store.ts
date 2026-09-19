import { existsSync, mkdirSync } from 'node:fs'
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
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const sqlite = process.getBuiltinModule('node:sqlite') as SqliteModule
  db = new sqlite.DatabaseSync(path)
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
  return db
}

/** Crude but sufficient: a fixed window per key, held in memory. */
const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(bucket: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const found = hits.get(bucket)
  if (!found || now > found.resetAt) {
    hits.set(bucket, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (found.count >= limit) return false
  found.count += 1
  return true
}
