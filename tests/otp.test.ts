import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The verification code, tested against a real SQLite database in a temp directory.
 *
 * This is the thing standing between a stranger and someone else's licence key, so it is worth
 * testing the actual storage rather than a mock of it — the attempt cap and the expiry both live
 * in SQL, and a mock would happily agree with a broken query.
 */

const dir = mkdtempSync(join(tmpdir(), 'spydir-otp-'))

let issueCode: typeof import('../site/lib/server/otp').issueCode
let checkCode: typeof import('../site/lib/server/otp').checkCode
let pruneCodes: typeof import('../site/lib/server/otp').pruneCodes
let store: typeof import('../site/lib/server/store').store
let MAX_ATTEMPTS: number
let MAX_SENDS: number

beforeAll(async () => {
  process.env.LICENSE_DB = join(dir, 'test.db')
  process.env.LICENSE_PEPPER = 'a-test-pepper-that-is-long-enough'
  const otp = await import('../site/lib/server/otp')
  const storeModule = await import('../site/lib/server/store')
  issueCode = otp.issueCode
  checkCode = otp.checkCode
  pruneCodes = otp.pruneCodes
  MAX_ATTEMPTS = otp.MAX_ATTEMPTS
  MAX_SENDS = otp.MAX_SENDS
  store = storeModule.store
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  store().exec('DELETE FROM otp')
  vi.useRealTimers()
})

const EMAIL = 'someone@example.com'

describe('issueCode', () => {
  it('produces six digits', () => {
    const issued = issueCode(EMAIL)
    expect(issued.ok).toBe(true)
    if (issued.ok) expect(issued.code).toMatch(/^\d{6}$/)
  })

  it('never stores the code itself', () => {
    const issued = issueCode(EMAIL)
    const row = store().prepare('SELECT code_hash FROM otp WHERE email = ?').get(EMAIL) as { code_hash: string }
    if (issued.ok) expect(row.code_hash).not.toContain(issued.code)
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  /** Two live codes for one address doubles the guessing surface and confuses the reader. */
  it('replaces the live code rather than adding a second', () => {
    issueCode(EMAIL)
    issueCode(EMAIL)
    const rows = store().prepare('SELECT COUNT(*) AS n FROM otp WHERE email = ?').get(EMAIL) as { n: number }
    expect(rows.n).toBe(1)
  })

  it('invalidates the previous code when a new one is sent', () => {
    const first = issueCode(EMAIL)
    issueCode(EMAIL)
    if (first.ok) expect(checkCode(EMAIL, first.code)).toMatchObject({ ok: false })
  })

  it('stops sending after the cap, so asking repeatedly is bounded', () => {
    for (let i = 0; i < MAX_SENDS; i += 1) expect(issueCode(EMAIL).ok).toBe(true)
    expect(issueCode(EMAIL)).toEqual({ ok: false, reason: 'too-many' })
  })
})

describe('checkCode', () => {
  it('accepts the right code', () => {
    const issued = issueCode(EMAIL)
    if (issued.ok) expect(checkCode(EMAIL, issued.code)).toEqual({ ok: true })
  })

  /** One code, one use — otherwise anyone who saw it in transit can replay it. */
  it('consumes the code, so it cannot be used twice', () => {
    const issued = issueCode(EMAIL)
    if (!issued.ok) throw new Error('expected a code')
    expect(checkCode(EMAIL, issued.code)).toEqual({ ok: true })
    expect(checkCode(EMAIL, issued.code)).toEqual({ ok: false, reason: 'expired' })
  })

  it('counts down wrong attempts and then destroys the challenge', () => {
    issueCode(EMAIL)
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      expect(checkCode(EMAIL, '000000')).toEqual({ ok: false, reason: 'wrong', attemptsLeft: MAX_ATTEMPTS - i })
    }
    expect(checkCode(EMAIL, '000000')).toEqual({ ok: false, reason: 'exhausted' })
    // Even the correct code is gone now: the whole challenge went with it.
    expect(checkCode(EMAIL, '123456')).toEqual({ ok: false, reason: 'expired' })
  })

  it('refuses a code belonging to a different address', () => {
    const issued = issueCode(EMAIL)
    if (issued.ok) expect(checkCode('someone.else@example.com', issued.code)).toEqual({ ok: false, reason: 'expired' })
  })

  it('refuses a code once it has expired', () => {
    const issued = issueCode(EMAIL)
    if (!issued.ok) throw new Error('expected a code')
    // Reach past the TTL rather than waiting ten minutes for it.
    store()
      .prepare('UPDATE otp SET expires_at = ? WHERE email = ?')
      .run(new Date(Date.now() - 1000).toISOString(), EMAIL)
    expect(checkCode(EMAIL, issued.code)).toEqual({ ok: false, reason: 'expired' })
  })

  it('has nothing to check when no code was ever issued', () => {
    expect(checkCode('stranger@example.com', '123456')).toEqual({ ok: false, reason: 'expired' })
  })
})

describe('pruneCodes', () => {
  it('clears expired challenges and leaves live ones', () => {
    issueCode('live@example.com')
    issueCode('stale@example.com')
    store()
      .prepare('UPDATE otp SET expires_at = ? WHERE email = ?')
      .run(new Date(Date.now() - 1000).toISOString(), 'stale@example.com')

    expect(pruneCodes()).toBe(1)
    const left = store().prepare('SELECT email FROM otp').all() as { email: string }[]
    expect(left.map((r) => r.email)).toEqual(['live@example.com'])
  })
})
