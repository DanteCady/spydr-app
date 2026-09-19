import { describe, expect, it } from 'vitest'
import { isSystemContainer } from '../src/lib/tree'
import type { DirectoryNode } from '../shared/types'

const BASE = 'DC=corp,DC=example,DC=com'

function container(rdn: string, type: DirectoryNode['type'] = 'container'): DirectoryNode {
  const dn = `${type === 'ou' ? 'OU' : 'CN'}=${rdn},${BASE}`
  return {
    id: dn,
    type,
    dn,
    parentDn: BASE,
    name: rdn,
    displayName: rdn,
    sAMAccountName: '',
    description: ''
  }
}

describe('isSystemContainer', () => {
  it('keeps the containers an admin manages', () => {
    for (const rdn of ['Users', 'Computers', 'Builtin', 'Managed Service Accounts']) {
      expect(isSystemContainer(container(rdn), BASE)).toBe(false)
    }
  })

  it("hides Active Directory's own bookkeeping", () => {
    for (const rdn of ['System', 'Program Data', 'NTDS Quotas', 'Infrastructure', 'LostAndFound', 'Keys']) {
      expect(isSystemContainer(container(rdn), BASE)).toBe(true)
    }
  })

  it('hides ForeignSecurityPrincipals, which holds SIDs from trusted domains', () => {
    expect(isSystemContainer(container('ForeignSecurityPrincipals'), BASE)).toBe(true)
  })

  it('never treats an OU or the domain root as internal', () => {
    expect(isSystemContainer(container('Corp', 'ou'), BASE)).toBe(false)
    const root = { ...container('corp'), dn: BASE }
    expect(isSystemContainer(root, BASE)).toBe(false)
  })

  it('ignores case, as LDAP does', () => {
    expect(isSystemContainer(container('USERS'), BASE)).toBe(false)
    expect(isSystemContainer(container('system'), BASE)).toBe(true)
  })
})
