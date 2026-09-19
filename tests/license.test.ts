import { describe, expect, it } from 'vitest'
import { keyHint, keyLooksValid, normalizeKey, statusOf, tidyKeyInput, GRACE_DAYS } from '../shared/license'
import type { SignedLicence } from '../shared/license'

const KEY = 'SPYDR-4PEH4-M9TFA-A37EB-ZZ3DB'

describe('normalizeKey', () => {
  it('accepts a key however it arrives from an email or a PDF', () => {
    expect(normalizeKey(KEY)).toBe(KEY)
    expect(normalizeKey(`  ${KEY}  `)).toBe(KEY)
    expect(normalizeKey(KEY.toLowerCase())).toBe(KEY)
    // A line break mid-key, which is what a wrapped email does.
    expect(normalizeKey('SPYDR-4PEH4-M9TFA-\nA37EB-ZZ3DB')).toBe(KEY)
    // Non-breaking spaces, which is what copying from a web page does.
    expect(normalizeKey('SPYDR-4PEH4-M9TFA- A37EB-ZZ3DB')).toBe(KEY)
    // No dashes at all, and no prefix.
    expect(normalizeKey('SPYDR4PEH4M9TFAA37EBZZ3DB')).toBe(KEY)
    expect(normalizeKey('4PEH4M9TFAA37EBZZ3DB')).toBe(KEY)
  })

  it('is idempotent, so normalising twice cannot corrupt a key', () => {
    expect(normalizeKey(normalizeKey(KEY))).toBe(KEY)
  })

  it('does not invent a key out of nothing', () => {
    expect(keyLooksValid(normalizeKey(''))).toBe(false)
    expect(keyLooksValid(normalizeKey('   '))).toBe(false)
    expect(keyLooksValid(normalizeKey('hello'))).toBe(false)
  })
})

describe('keyLooksValid', () => {
  it('passes a key that only needed tidying', () => {
    expect(keyLooksValid(` ${KEY.toLowerCase()} `)).toBe(true)
    expect(keyLooksValid('SPYDR-4PEH4-M9TFA-\nA37EB-ZZ3DB')).toBe(true)
  })

  it('rejects the wrong length and the excluded letters', () => {
    expect(keyLooksValid('SPYDR-4PEH4-M9TFA-A37EB')).toBe(false)
    expect(keyLooksValid('SPYDR-4PEH4-M9TFA-A37EB-ZZ3D')).toBe(false)
    // Crockford base32 has no I, L, O or U, so these cannot be real keys.
    expect(keyLooksValid('SPYDR-IIIII-LLLLL-OOOOO-UUUUU')).toBe(false)
  })
})

describe('tidyKeyInput', () => {
  it('strips whitespace as it is typed without reformatting mid-edit', () => {
    expect(tidyKeyInput(' spydr-4peh4 ')).toBe('SPYDR-4PEH4')
    expect(tidyKeyInput('SPYDR-4PEH4-M9TFA-​A37EB')).toBe('SPYDR-4PEH4-M9TFA-A37EB')
  })
})

describe('keyHint', () => {
  it('shows only the last group', () => {
    expect(keyHint(KEY)).toBe('SPYDR-•••••-•••••-•••••-ZZ3DB')
    expect(keyHint(KEY)).not.toContain('4PEH4')
  })
})

describe('statusOf', () => {
  const licence = (over: Partial<SignedLicence>): SignedLicence => ({
    key: KEY,
    email: 'admin@corp.example.com',
    tier: 'free',
    features: [],
    expiresAt: null,
    issuedAt: '2026-01-01T00:00:00.000Z',
    notAfter: '2026-02-01T00:00:00.000Z',
    ...over
  })
  const day = 86_400_000

  it('is active until the check falls due', () => {
    const now = new Date('2026-01-20T00:00:00.000Z')
    expect(statusOf(licence({}), now)).toBe('active')
  })

  it('keeps working through the grace window when the check is overdue', () => {
    const due = new Date('2026-02-01T00:00:00.000Z')
    expect(statusOf(licence({}), new Date(due.getTime() + 5 * day))).toBe('grace')
    expect(statusOf(licence({}), new Date(due.getTime() + (GRACE_DAYS - 1) * day))).toBe('grace')
  })

  it('lapses only well past the grace window', () => {
    const due = new Date('2026-02-01T00:00:00.000Z')
    expect(statusOf(licence({}), new Date(due.getTime() + (GRACE_DAYS + 1) * day))).toBe('lapsed')
  })

  it('lapses immediately when the licence itself expired', () => {
    const expired = licence({ expiresAt: '2026-01-10T00:00:00.000Z' })
    expect(statusOf(expired, new Date('2026-01-15T00:00:00.000Z'))).toBe('lapsed')
  })
})
