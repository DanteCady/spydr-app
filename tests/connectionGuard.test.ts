import { describe, expect, it } from 'vitest'
import { isHostish, validConnection } from '../shared/connection'
import type { ConnectionInput } from '../shared/types'

/**
 * The guard main applies to anything the renderer offers as a bind target.
 *
 * This file exists because the first version of that guard checked a field called `bindPassword`,
 * which is not on ConnectionInput — the field is `password`. Every real connection was therefore
 * rejected and the app could not bind to a directory at all, while every existing test still
 * passed, because none of them fed it a connection.
 *
 * So the first test is the one that matters: a payload shaped exactly as the Connect screen builds
 * it must be accepted. A guard nobody feeds real input to is a guard that only rejects.
 */

/** Assembled the same way src/workspaces/Connect.tsx does, field for field. */
function fromConnectScreen(overrides: Partial<ConnectionInput> = {}): ConnectionInput {
  return {
    domain: 'corp.example.com',
    host: 'dc01.corp.example.com',
    port: 636,
    protocol: 'ldaps',
    bindUsername: 'reader@corp.example.com',
    password: 'a password with spaces & symbols £€',
    trustServerCert: false,
    baseDn: 'DC=corp,DC=example,DC=com',
    rememberPassword: false,
    ...overrides
  }
}

describe('validConnection', () => {
  it('accepts what the Connect screen actually sends', () => {
    expect(validConnection(fromConnectScreen())).toBe(true)
  })

  it('accepts every protocol the UI offers', () => {
    for (const protocol of ['ldap', 'ldaps', 'starttls'] as const) {
      const port = protocol === 'ldaps' ? 636 : 389
      expect(validConnection(fromConnectScreen({ protocol, port })), protocol).toBe(true)
    }
  })

  /** A password is the user's business. Rules here would reject valid credentials. */
  it('does not police the password beyond its type', () => {
    expect(validConnection(fromConnectScreen({ password: '' }))).toBe(true)
    expect(validConnection(fromConnectScreen({ password: 'x'.repeat(512) }))).toBe(true)
  })

  it('accepts a pasted IP address as the host', () => {
    expect(validConnection(fromConnectScreen({ host: '10.1.2.3' }))).toBe(true)
  })

  it('rejects a missing or malformed host', () => {
    expect(validConnection(fromConnectScreen({ host: '' }))).toBe(false)
    expect(validConnection(fromConnectScreen({ host: 'dc01 corp; rm -rf' }))).toBe(false)
    expect(validConnection(fromConnectScreen({ host: 'a'.repeat(254) }))).toBe(false)
  })

  it('rejects a port outside the usable range', () => {
    for (const port of [0, -1, 65_536, 1.5, Number.NaN]) {
      expect(validConnection(fromConnectScreen({ port })), String(port)).toBe(false)
    }
  })

  it('rejects a protocol outside the enum', () => {
    expect(validConnection(fromConnectScreen({ protocol: 'ftp' as ConnectionInput['protocol'] }))).toBe(false)
  })

  it('rejects an empty bind username', () => {
    expect(validConnection(fromConnectScreen({ bindUsername: '' }))).toBe(false)
  })

  it('rejects anything that is not an object', () => {
    for (const value of [null, undefined, 'string', 42, [], true]) {
      expect(validConnection(value), JSON.stringify(value) ?? 'undefined').toBe(false)
    }
  })

  /** The renderer is ours, but in a compromised domain its inputs may not be. */
  it('rejects a connection with a required field missing entirely', () => {
    const { password: _password, ...withoutPassword } = fromConnectScreen()
    expect(validConnection(withoutPassword)).toBe(false)

    const { host: _host, ...withoutHost } = fromConnectScreen()
    expect(validConnection(withoutHost)).toBe(false)
  })
})

describe('isHostish', () => {
  it('accepts names and addresses a directory actually uses', () => {
    for (const value of ['corp.example.com', 'dc01', '10.1.2.3', 'sub-domain.corp.example.com']) {
      expect(isHostish(value), value).toBe(true)
    }
  })

  /**
   * discoverDcs concatenates this into an SRV lookup, so an unbounded string is a DNS channel out
   * of the process — the query itself carries the message.
   */
  it('rejects what would make it a DNS exfiltration channel', () => {
    expect(isHostish('')).toBe(false)
    expect(isHostish('x'.repeat(254))).toBe(false)
    expect(isHostish('data-to-leak.attacker com')).toBe(false)
    expect(isHostish('has/slash')).toBe(false)
    expect(isHostish(42)).toBe(false)
  })
})
