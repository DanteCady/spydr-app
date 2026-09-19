import { describe, expect, it } from 'vitest'
import { clientOptions } from '../electron/directory/ldapProvider'
import type { ConnectionInput, Protocol } from '../shared/types'

function input(protocol: Protocol, port: number): ConnectionInput {
  return {
    domain: 'corp.example.com',
    host: 'dc01.corp.example.com',
    port,
    protocol,
    bindUsername: 'corp\\admin',
    password: 'unused',
    trustServerCert: true,
    baseDn: '',
    rememberPassword: false
  }
}

describe('clientOptions', () => {
  it('only sends TLS options on ldaps, so plaintext ports are not handed a TLS socket', () => {
    expect(clientOptions(input('ldap', 389)).tlsOptions).toBeUndefined()
    expect(clientOptions(input('starttls', 389)).tlsOptions).toBeUndefined()
    expect(clientOptions(input('ldaps', 636)).tlsOptions).toEqual({ rejectUnauthorized: false })
  })

  it('carries the certificate choice through to ldaps', () => {
    const strict = { ...input('ldaps', 636), trustServerCert: false }
    expect(clientOptions(strict).tlsOptions).toEqual({ rejectUnauthorized: true })
  })

  it('uses the ldaps scheme only for ldaps', () => {
    expect(clientOptions(input('ldaps', 636)).url).toBe('ldaps://dc01.corp.example.com:636')
    expect(clientOptions(input('starttls', 389)).url).toBe('ldap://dc01.corp.example.com:389')
    expect(clientOptions(input('ldap', 389)).url).toBe('ldap://dc01.corp.example.com:389')
  })
})
