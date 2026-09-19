#!/usr/bin/env node
import { randomUUID, randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Seeds the reserved keys — the ones handed to developers and beta testers rather than issued by
 * the signup form — and writes them to an encrypted file.
 *
 * The passphrase comes from KEYS_PASSPHRASE and is never written anywhere: not to the file, not to
 * the database, not to this repository. The output is AES-256-GCM over a scrypt-derived key, so
 * the file is useless without it.
 *
 *   KEYS_PASSPHRASE=… node scripts/reserved-keys.mjs seed
 *   KEYS_PASSPHRASE=… node scripts/reserved-keys.mjs read
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const OUT = process.env.KEYS_FILE ?? join(process.cwd(), 'keys', 'reserved-keys.enc')
const DB = process.env.LICENSE_DB ?? './data/spydr.db'

const PLAN = [
  { kind: 'developer', count: 10, tier: 'enterprise', features: ['scheduled-reports', 'multi-domain', 'write-operations', 'team-sync', 'priority-support'] },
  { kind: 'beta', count: 20, tier: 'team', features: ['scheduled-reports', 'multi-domain'] }
]

function passphrase() {
  const value = process.env.KEYS_PASSPHRASE
  if (!value) {
    console.error('Set KEYS_PASSPHRASE. It is never stored — losing it means reseeding the reserved keys.')
    process.exit(1)
  }
  return value
}

function newKey() {
  const bytes = randomBytes(20)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return `SPYDR-${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15, 20)}`
}

function db() {
  const dir = dirname(DB)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite')
  const handle = new DatabaseSync(DB)
  handle.exec(`
    CREATE TABLE IF NOT EXISTS licence (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE,
      tier TEXT NOT NULL DEFAULT 'free', features TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, expires_at TEXT, revoked INTEGER NOT NULL DEFAULT 0, note TEXT, key_enc TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS licence_email_live ON licence (email) WHERE revoked = 0;
  `)
  return handle
}

function encrypt(text, secret) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(secret, salt, 32, { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 })
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return JSON.stringify(
    {
      format: 'spydr-reserved-keys/1',
      kdf: 'scrypt',
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      body: body.toString('base64')
    },
    null,
    2
  )
}

function decrypt(blob, secret) {
  const file = JSON.parse(blob)
  const key = scryptSync(secret, Buffer.from(file.salt, 'base64'), 32, { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 })
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(file.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(file.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(file.body, 'base64')), decipher.final()]).toString('utf8')
}

function seed() {
  const secret = passphrase()
  const handle = db()
  const issued = []
  const now = new Date().toISOString()

  for (const group of PLAN) {
    for (let i = 1; i <= group.count; i += 1) {
      const label = `${group.kind}-${String(i).padStart(2, '0')}`
      const email = `${label}@reserved.spydr`
      if (handle.prepare('SELECT 1 FROM licence WHERE email = ? AND revoked = 0').get(email)) {
        console.log(`${label} already exists — left alone`)
        continue
      }
      const key = newKey()
      handle
        .prepare(
          `INSERT INTO licence (id, email, key_hash, tier, features, created_at, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          randomUUID(),
          email,
          createHash('sha256').update(key).digest('hex'),
          group.tier,
          JSON.stringify(group.features),
          now,
          `reserved:${group.kind}`
        )
      issued.push({ label, kind: group.kind, tier: group.tier, key })
    }
  }

  if (issued.length === 0) {
    console.log('Nothing to do — every reserved key already exists.')
    return
  }

  const text = [
    'SPYDR reserved keys',
    `Generated ${now}`,
    '',
    ...issued.map((k) => `${k.label.padEnd(12)} ${k.tier.padEnd(11)} ${k.key}`),
    '',
    'These are not recoverable from the database: only a hash is stored there.',
    'Keep this file, and its passphrase, somewhere that survives this laptop.'
  ].join('\n')

  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, encrypt(text, secret), 'utf8')
  console.log(`${issued.length} keys written to ${OUT}`)
  console.log('The passphrase was not stored. Without it the file cannot be opened.')
}

function read() {
  const secret = passphrase()
  if (!existsSync(OUT)) {
    console.error(`No key file at ${OUT}`)
    process.exit(1)
  }
  try {
    console.log(decrypt(readFileSync(OUT, 'utf8'), secret))
  } catch {
    console.error('That passphrase does not open this file.')
    process.exit(1)
  }
}

const command = process.argv[2]
if (command === 'seed') seed()
else if (command === 'read') read()
else {
  console.error('Usage: KEYS_PASSPHRASE=… node scripts/reserved-keys.mjs <seed|read>')
  process.exit(1)
}
