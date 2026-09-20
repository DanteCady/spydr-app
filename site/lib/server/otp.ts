import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { store } from './store'

/**
 * Proving that whoever asked for a key can read the address they asked from.
 *
 * This is not really an anti-spam measure. It closes a specific hole: issuing a key on an
 * unverified address meant anyone could type someone else's address, take the only key that
 * address will ever be given, and leave the real owner permanently unable to sign up for a key
 * they never received. It also removes the question `/api/signup` used to answer — "is this
 * address registered?" — because every request now gets the same reply either way.
 *
 * Codes are hashed, not stored. They are short-lived and low-entropy by nature, so the thing that
 * makes them safe is the attempt cap rather than the code itself: six digits is a million
 * possibilities, and five guesses against one live challenge is not a useful attack.
 */

export const CODE_LENGTH = 6
export const TTL_MINUTES = 10
/** Wrong guesses allowed against one challenge before it is destroyed. */
export const MAX_ATTEMPTS = 5
/** How many times one address may be sent a code before it has to wait. */
export const MAX_SENDS = 5

interface Row {
  email: string
  code_hash: string
  created_at: string
  expires_at: string
  attempts: number
  sends: number
}

function hash(email: string, code: string): string {
  // The address is mixed in, so a stolen hash cannot be replayed against a different one.
  const pepper = process.env.LICENSE_PEPPER ?? 'development-only-pepper'
  return createHash('sha256').update(`${pepper}:${email}:${code}`).digest('hex')
}

/** Six digits, uniformly. randomInt is rejection-sampled, so there is no modulo bias. */
function newCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) code += String(randomInt(0, 10))
  return code
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export type IssueResult = { ok: true; code: string } | { ok: false; reason: 'too-many' }

/**
 * Start or replace the challenge for an address.
 *
 * Asking again replaces the code rather than adding a second one: two live codes for one address
 * doubles the guessing surface and means a person reading their inbox has to work out which of
 * two emails is the current one.
 */
export function issueCode(email: string): IssueResult {
  const db = store()
  const now = new Date()
  const existing = db.prepare('SELECT * FROM otp WHERE email = ?').get(email) as Row | undefined

  // The send counter survives the code being replaced, so asking repeatedly is bounded even
  // though each request is individually reasonable.
  const live = existing && new Date(existing.expires_at) > now
  const sends = live ? existing.sends + 1 : 1
  if (live && sends > MAX_SENDS) return { ok: false, reason: 'too-many' }

  const code = newCode()
  db.prepare(
    `INSERT INTO otp (email, code_hash, created_at, expires_at, attempts, sends)
     VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT (email) DO UPDATE SET
       code_hash = excluded.code_hash,
       created_at = excluded.created_at,
       expires_at = excluded.expires_at,
       attempts = 0,
       sends = excluded.sends`
  ).run(email, hash(email, code), now.toISOString(), new Date(now.getTime() + TTL_MINUTES * 60_000).toISOString(), sends)

  return { ok: true, code }
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'wrong' | 'exhausted'; attemptsLeft?: number }

/**
 * Check a code, and consume the challenge whether or not it was right.
 *
 * A correct code deletes the row: one code, one use. A wrong one increments the attempt count and
 * deletes the row once the cap is reached, so a challenge cannot be ground down.
 */
export function checkCode(email: string, code: string): CheckResult {
  const db = store()
  const row = db.prepare('SELECT * FROM otp WHERE email = ?').get(email) as Row | undefined

  if (!row) return { ok: false, reason: 'expired' }
  if (new Date(row.expires_at) <= new Date()) {
    db.prepare('DELETE FROM otp WHERE email = ?').run(email)
    return { ok: false, reason: 'expired' }
  }

  if (same(row.code_hash, hash(email, code))) {
    db.prepare('DELETE FROM otp WHERE email = ?').run(email)
    return { ok: true }
  }

  const attempts = row.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    db.prepare('DELETE FROM otp WHERE email = ?').run(email)
    return { ok: false, reason: 'exhausted' }
  }
  db.prepare('UPDATE otp SET attempts = ? WHERE email = ?').run(attempts, email)
  return { ok: false, reason: 'wrong', attemptsLeft: MAX_ATTEMPTS - attempts }
}

/** Expired challenges are worthless; clearing them keeps the table from being a slow leak. */
export function pruneCodes(): number {
  const result = store().prepare('DELETE FROM otp WHERE expires_at < ?').run(new Date().toISOString())
  return Number(result.changes ?? 0)
}
