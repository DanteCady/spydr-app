import type { ConnectionInput } from './types'

/**
 * What main will accept from the renderer as somewhere to bind.
 *
 * This lives in shared/ rather than beside the IPC handlers for one reason: it is testable here.
 * The first version of it was written inline in main.ts, checked a field called `bindPassword`
 * that does not exist on ConnectionInput — the field is `password` — and therefore rejected every
 * connection the UI could produce. Nothing caught it, because a hand-rolled predicate reading off
 * `Record<string, unknown>` will happily test a field name that was never there.
 *
 * So the shape below is keyed to ConnectionInput itself. A typo, or a field renamed in types.ts,
 * is now a compile error rather than an app that silently cannot connect to anything.
 */

/** Only the fields that must be present and well-formed; the optional ones are not load-bearing. */
type Required = Pick<
  ConnectionInput,
  'domain' | 'host' | 'port' | 'protocol' | 'bindUsername' | 'password' | 'baseDn' | 'trustServerCert'
>

/** Indexed by the real keys, so `c.bindPassword` cannot compile. */
type Candidate = Partial<Record<keyof Required, unknown>>

/**
 * A DNS name, loosely: labels of letters, digits and hyphens, separated by dots.
 *
 * discoverDcs concatenates this into an SRV lookup, so without a bound on it the renderer has a
 * general-purpose DNS channel — every query goes out to a resolver, and the name itself is the
 * message. Directory data is attacker-written in a compromised domain, so this is worth closing
 * even though the renderer is ours.
 */
export function isHostish(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 253 && /^[A-Za-z0-9._-]+$/.test(value)
}

/**
 * The renderer chooses where to bind, because that is where the user types it. It does not get to
 * choose anything the shape of which we cannot check first.
 *
 * The password is checked for type only. It is a secret the user typed and none of our business
 * beyond "it is a string" — length or character rules here would reject valid credentials.
 */
export function validConnection(input: unknown): input is ConnectionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const c = input as Candidate

  return (
    isHostish(c.host) &&
    typeof c.port === 'number' &&
    Number.isInteger(c.port) &&
    c.port >= 1 &&
    c.port <= 65535 &&
    (c.protocol === 'ldap' || c.protocol === 'ldaps' || c.protocol === 'starttls') &&
    typeof c.domain === 'string' &&
    c.domain.length <= 253 &&
    typeof c.bindUsername === 'string' &&
    c.bindUsername.length > 0 &&
    c.bindUsername.length <= 256 &&
    typeof c.password === 'string' &&
    typeof c.baseDn === 'string' &&
    c.baseDn.length <= 1024 &&
    typeof c.trustServerCert === 'boolean'
  )
}
