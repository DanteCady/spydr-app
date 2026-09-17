import { Client } from 'ldapts'
import { enrichSnapshot } from '../../shared/enrich'
import type { ConnectionInput, DirectoryEdge, DirectoryNode, DirectorySnapshot, TestConnectionResult } from '../../shared/types'
import { mapLdapError } from './errors'
import {
  fileTimeMs,
  first,
  generalizedTime,
  guidFrom,
  memberAttrNames,
  parentDn,
  ridFrom,
  strings
} from './parse'

const USER_FILTER = '(&(objectCategory=person)(objectClass=user))'
const GROUP_FILTER = '(objectClass=group)'
const OU_FILTER = '(objectClass=organizationalUnit)'
const CONTAINER_FILTER = '(|(objectClass=container)(objectClass=builtinDomain)(objectClass=domainDNS))'
const COMPUTER_FILTER = '(objectClass=computer)'

const USER_ATTRS = [
  'objectGUID',
  'distinguishedName',
  'name',
  'displayName',
  'sAMAccountName',
  'userPrincipalName',
  'description',
  'mail',
  'physicalDeliveryOfficeName',
  'userAccountControl',
  'lastLogonTimestamp',
  'whenCreated',
  'whenChanged',
  'primaryGroupID',
  'objectSid',
  'memberOf'
]
const GROUP_ATTRS = [
  'objectGUID',
  'distinguishedName',
  'name',
  'displayName',
  'sAMAccountName',
  'description',
  'groupType',
  'managedBy',
  'whenCreated',
  'whenChanged',
  'objectSid',
  'member'
]
const OU_ATTRS = ['objectGUID', 'distinguishedName', 'name', 'ou', 'cn', 'description', 'whenCreated', 'whenChanged']
const COMPUTER_ATTRS = [
  'objectGUID',
  'distinguishedName',
  'name',
  'displayName',
  'sAMAccountName',
  'description',
  'operatingSystem',
  'userAccountControl',
  'lastLogonTimestamp',
  'whenCreated'
]

function ldapUrl(input: ConnectionInput): string {
  const scheme = input.protocol === 'ldaps' ? 'ldaps' : 'ldap'
  return `${scheme}://${input.host}:${input.port}`
}

async function withClient<T>(input: ConnectionInput, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    url: ldapUrl(input),
    timeout: 30_000,
    connectTimeout: 8_000,
    tlsOptions: { rejectUnauthorized: !input.trustServerCert }
  })
  try {
    if (input.protocol === 'starttls') {
      await client.startTLS({ rejectUnauthorized: !input.trustServerCert })
    }
    await client.bind(input.bindUsername, input.password)
    return await fn(client)
  } catch (err) {
    throw new Error(mapLdapError(err))
  } finally {
    try {
      await client.unbind()
    } catch {
      /* ignore */
    }
  }
}






/**
 * Relative identifier from an objectSid. A user's primary group is stored as this RID on the
 * user, not as a member/memberOf link, so it is the only way to see Domain Users membership.
 */



async function searchAll(client: Client, baseDn: string, filter: string, attributes: string[]): Promise<Record<string, unknown>[]> {
  const { searchEntries } = await client.search(baseDn, {
    scope: 'sub',
    filter,
    attributes,
    paged: { pageSize: 500 },
    explicitBufferAttributes: ['objectGUID', 'objectSid']
  })
  return searchEntries as unknown as Record<string, unknown>[]
}


async function readMembers(client: Client, dn: string, seed: Record<string, unknown>): Promise<string[]> {
  const collected: string[] = []
  const take = (entry: Record<string, unknown>): { dns: string[]; next: number | null } => {
    let next: number | null = null
    const dns: string[] = []
    for (const key of memberAttrNames(entry)) {
      const lower = key.toLowerCase()
      if (lower === 'memberof') continue
      dns.push(...strings(entry[key]))
      const range = /;range=(\d+)-(\d+|\*)/i.exec(key)
      if (range && range[2] !== '*') next = Number(range[2]) + 1
    }
    return { dns, next }
  }

  const firstPage = take(seed)
  collected.push(...firstPage.dns)
  let start = firstPage.next
  while (start != null) {
    const attr = `member;range=${start}-${start + 1499}`
    const { searchEntries } = await client.search(dn, {
      scope: 'base',
      attributes: [attr],
      filter: '(objectClass=*)'
    })
    const entry = (searchEntries[0] ?? {}) as Record<string, unknown>
    const page = take(entry)
    collected.push(...page.dns)
    start = page.next
    if (page.dns.length === 0) break
  }
  return collected
}

function toNode(
  entry: Record<string, unknown>,
  type: DirectoryNode['type']
): DirectoryNode | null {
  const dn = first(entry.distinguishedName) || first(entry.dn)
  if (!dn) return null
  const name = first(entry.displayName) || first(entry.name) || first(entry.ou) || first(entry.cn) || dn
  const uac = first(entry.userAccountControl)
  const groupType = first(entry.groupType)
  return {
    id: guidFrom(entry),
    type,
    dn,
    parentDn: parentDn(dn),
    name: first(entry.name) || first(entry.ou) || first(entry.cn) || name,
    displayName: name,
    sAMAccountName: first(entry.sAMAccountName) || first(entry.samaccountname),
    description: first(entry.description),
    mail: first(entry.mail) || undefined,
    userPrincipalName: first(entry.userPrincipalName) || undefined,
    office: first(entry.physicalDeliveryOfficeName) || undefined,
    userAccountControl: uac ? Number(uac) : undefined,
    lastLogonTimestamp: entry.lastLogonTimestamp != null ? fileTimeMs(entry.lastLogonTimestamp) : undefined,
    whenCreated: generalizedTime(entry.whenCreated),
    whenChanged: generalizedTime(entry.whenChanged),
    groupType: groupType ? Number(groupType) : undefined,
    managedBy: first(entry.managedBy) || undefined,
    operatingSystem: first(entry.operatingSystem) || undefined,
    primaryGroupId: first(entry.primaryGroupID) ? Number(first(entry.primaryGroupID)) : undefined
  }
}

export async function testConnection(input: ConnectionInput): Promise<TestConnectionResult> {
  return withClient(input, async (client) => {
    const { searchEntries } = await client.search('', {
      scope: 'base',
      attributes: ['defaultNamingContext', 'dnsHostName', 'domainFunctionality']
    })
    const root = (searchEntries[0] ?? {}) as Record<string, unknown>
    const defaultNamingContext = first(root.defaultNamingContext)
    return {
      ok: true as const,
      dnsHostName: first(root.dnsHostName) || input.host,
      defaultNamingContext,
      boundAs: input.bindUsername,
      protocol: input.protocol,
      domainFunctionality: first(root.domainFunctionality) || undefined
    }
  })
}

export async function ingestDirectory(input: ConnectionInput): Promise<DirectorySnapshot> {
  return withClient(input, async (client) => {
    const tested = await (async () => {
      const { searchEntries } = await client.search('', {
        scope: 'base',
        attributes: ['defaultNamingContext', 'dnsHostName']
      })
      const root = (searchEntries[0] ?? {}) as Record<string, unknown>
      return {
        baseDn: input.baseDn.trim() || first(root.defaultNamingContext),
        dcHost: first(root.dnsHostName) || input.host
      }
    })()

    if (!tested.baseDn) throw new Error('Could not read defaultNamingContext from rootDSE. Enter a base DN.')

    const [users, groups, ous, containers, computers] = await Promise.all([
      searchAll(client, tested.baseDn, USER_FILTER, USER_ATTRS),
      searchAll(client, tested.baseDn, GROUP_FILTER, GROUP_ATTRS),
      searchAll(client, tested.baseDn, OU_FILTER, OU_ATTRS),
      searchAll(client, tested.baseDn, CONTAINER_FILTER, OU_ATTRS),
      searchAll(client, tested.baseDn, COMPUTER_FILTER, COMPUTER_ATTRS)
    ])

    const nodes: DirectoryNode[] = []
    const seenDn = new Set<string>()
    const add = (entry: Record<string, unknown>, type: DirectoryNode['type']): void => {
      const node = toNode(entry, type)
      if (!node) return
      const key = node.dn.toLowerCase()
      if (seenDn.has(key)) return
      seenDn.add(key)
      nodes.push(node)
    }

    for (const e of containers) add(e, 'container')
    for (const e of ous) add(e, 'ou')
    for (const e of users) add(e, 'user')
    for (const e of groups) add(e, 'group')
    for (const e of computers) add(e, 'computer')

    const byDn = new Map(nodes.map((n) => [n.dn.toLowerCase(), n]))
    const edges: DirectoryEdge[] = []
    const edgeKey = new Set<string>()
    const addEdge = (fromDn: string, toId: string, via: DirectoryEdge['via']): void => {
      const from = byDn.get(fromDn.toLowerCase())
      if (!from) return
      const k = `${from.id}->${toId}:${via}`
      if (edgeKey.has(k)) return
      edgeKey.add(k)
      edges.push({ from: from.id, to: toId, via })
    }

    const groupIdByRid = new Map<number, string>()
    for (const entry of groups) {
      const groupNode = toNode(entry, 'group')
      if (!groupNode) continue
      const rid = ridFrom(entry.objectSid ?? entry.objectsid)
      if (rid !== null) groupIdByRid.set(rid, groupNode.id)
      const members = await readMembers(client, groupNode.dn, entry)
      for (const memberDn of members) addEdge(memberDn, groupNode.id, 'member')
    }

    // Primary group membership (usually Domain Users) never appears in member/memberOf.
    for (const entry of [...users, ...computers]) {
      const rid = Number(first(entry.primaryGroupID))
      if (!rid) continue
      const groupId = groupIdByRid.get(rid)
      const dn = first(entry.distinguishedName) || first(entry.dn)
      if (groupId && dn) addEdge(dn, groupId, 'primaryGroup')
    }

    const domain = tested.baseDn
      .split(',')
      .filter((p) => p.toUpperCase().startsWith('DC='))
      .map((p) => p.slice(3))
      .join('.')
      .toLowerCase()

    return enrichSnapshot({
      domain: input.domain.trim() || domain,
      baseDn: tested.baseDn,
      source: 'ldap',
      dcHost: tested.dcHost,
      protocol: input.protocol,
      boundAs: input.bindUsername,
      nodes,
      edges
    })
  })
}
