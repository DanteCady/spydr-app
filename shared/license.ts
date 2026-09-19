/**
 * The licence, as the rest of the application sees it.
 *
 * SPYDR is free, and activated: a key issued at signup is checked on first run and roughly monthly
 * after that. The check exists so there is a count of who is using this and somewhere for paid
 * capability to attach later — not to police the directory reader, which is why an expired check
 * degrades to a warning rather than a locked door.
 */

export type LicenceStatus =
  /** No key has been entered on this machine. */
  | 'none'
  /** Checked recently and good. */
  | 'active'
  /** The check is overdue and the server could not be reached. Everything still works. */
  | 'grace'
  /** Overdue well past grace, or the server withdrew the key. */
  | 'lapsed'

export type Tier = 'free' | 'team' | 'enterprise'

/** Capability names, gated by the licence. All dormant today; free carries none of them. */
export type Feature = 'scheduled-reports' | 'multi-domain' | 'write-operations' | 'team-sync' | 'priority-support'

/** The part of an activation the server signs. */
export interface SignedLicence {
  key: string
  email: string
  tier: Tier
  features: Feature[]
  /** When the licence itself stops being valid; null means never. */
  expiresAt: string | null
  issuedAt: string
  /** When the app should check again. */
  notAfter: string
}

export interface LicenceState {
  status: LicenceStatus
  tier: Tier
  features: Feature[]
  email?: string
  /** Masked for display: only the last group is shown. */
  keyHint?: string
  checkedAt?: string
  notAfter?: string
  /** Why the last check failed, when it did. */
  message?: string
}

export const UNLICENSED: LicenceState = { status: 'none', tier: 'free', features: [] }

/** How long after the check is due the app keeps quiet about it. */
export const GRACE_DAYS = 21

export function keyHint(key: string): string {
  const groups = key.trim().toUpperCase().split('-')
  const last = groups.at(-1) ?? ''
  return `SPYDR-•••••-•••••-•••••-${last}`
}

/** Shape check only — the server decides whether a key is real. */
export function keyLooksValid(key: string): boolean {
  return /^SPYDR-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/.test(
    key.trim().toUpperCase()
  )
}

export function statusOf(licence: SignedLicence, now = new Date()): LicenceStatus {
  if (licence.expiresAt && new Date(licence.expiresAt) < now) return 'lapsed'
  const due = new Date(licence.notAfter)
  if (due >= now) return 'active'
  const graceEnds = new Date(due.getTime() + GRACE_DAYS * 86_400_000)
  return now <= graceEnds ? 'grace' : 'lapsed'
}

export function hasFeature(state: LicenceState, feature: Feature): boolean {
  return state.status !== 'lapsed' && state.features.includes(feature)
}

/** What to tell someone, in one line, about where their licence stands. */
export function describeLicence(state: LicenceState): string {
  switch (state.status) {
    case 'none':
      return 'No licence key on this machine.'
    case 'active':
      return `Licensed to ${state.email ?? 'this machine'} · ${state.tier}`
    case 'grace':
      return 'The monthly licence check is overdue and the server could not be reached. Everything still works.'
    case 'lapsed':
      return state.message ?? 'This licence needs checking again.'
  }
}
