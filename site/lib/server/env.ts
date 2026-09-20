/**
 * What production refuses to run without.
 *
 * Every one of these had a fallback that let the server start and keep answering 200s while doing
 * something quietly wrong: signing with a throwaway key nobody can verify, peppering with the
 * literal string "spydir", or encrypting licence keys with whatever the pepper happened to be. None
 * of those failures are visible from the outside, which is what makes them worth refusing over.
 *
 * Development keeps the fallbacks, because a local checkout should run with no setup at all.
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

interface Requirement {
  name: string
  /** Why it matters, in the words the operator needs to hear at 2am. */
  because: string
  /** Random secrets need length; a PEM needs to look like one. */
  check?: (value: string) => string | null
}

const REQUIRED: Requirement[] = [
  {
    name: 'LICENSE_PRIVATE_KEY',
    because:
      'without it every activation is signed by a key generated at boot, so no installed copy of SPYDIR can verify it and a restart invalidates every licence already issued',
    check: (v) => (v.includes('BEGIN PRIVATE KEY') ? null : 'must be a PKCS#8 PEM')
  },
  {
    name: 'LICENSE_PEPPER',
    because: 'without it machine identifiers are hashed with a value published in the source, making them reproducible by anyone',
    check: (v) => (v.length >= 32 ? null : 'must be at least 32 characters of random data')
  },
  {
    name: 'LICENSE_SECRET',
    because: 'it encrypts every stored licence key, and without it that job falls to the pepper, so one leak would do both',
    check: (v) => (v.length >= 32 ? null : 'must be at least 32 characters of random data')
  },
  {
    name: 'LICENSE_DB',
    because: 'the default path puts the licence database inside the deploy tree, where a deploy can erase it',
    check: (v) => (v.startsWith('/') ? null : 'must be an absolute path outside the deploy directory')
  },
  {
    name: 'TRUST_PROXY_HOPS',
    because:
      'it says how many proxies sit in front of Node, which is the only way to tell a real client address from one the caller typed into X-Forwarded-For — without it every rate limit collapses into a single shared bucket',
    check: (v) => (/^[1-9]$/.test(v) ? null : 'must be a small positive integer (1 for a single nginx in front)')
  }
]

let checked = false

/**
 * Called from the first request each route handles. Next has no boot hook that reliably runs once
 * in every deployment shape, so the next best thing is to fail the first request loudly rather
 * than serve a thousand quiet ones.
 */
export function requireProductionEnv(): void {
  if (checked || !isProduction()) return

  const problems: string[] = []
  for (const req of REQUIRED) {
    const value = process.env[req.name]?.trim()
    if (!value) {
      problems.push(`${req.name} is not set — ${req.because}`)
      continue
    }
    const complaint = req.check?.(value)
    if (complaint) problems.push(`${req.name} ${complaint} — ${req.because}`)
  }

  if (process.env.LICENSE_SECRET && process.env.LICENSE_SECRET === process.env.LICENSE_PEPPER) {
    problems.push('LICENSE_SECRET and LICENSE_PEPPER are the same value — they must differ, or one leak compromises both')
  }

  if (problems.length > 0) {
    throw new Error(`SPYDIR licence server is misconfigured:\n  - ${problems.join('\n  - ')}`)
  }
  checked = true
}
