import { enrichSnapshot } from '../shared/enrich'
import type { DirectoryEdge, DirectoryNode, DirectorySnapshot } from '../shared/types'

const BASE = 'DC=contoso,DC=lab'
const SECURITY_GLOBAL = 0x80000002
const SECURITY_DL = 0x80000004
const DIST_GLOBAL = 0x00000002
const UAC_NORMAL = 0x0200
const UAC_DISABLED = 0x0202
const UAC_NEVER_EXPIRE = 0x10200

const daysAgo = (days: number): number => Date.now() - days * 24 * 60 * 60 * 1000

function n(partial: Omit<DirectoryNode, 'description'> & { description?: string }): DirectoryNode {
  const { description = '', ...rest } = partial
  return { ...rest, description }
}

function buildRaw(): { nodes: DirectoryNode[]; edges: DirectoryEdge[] } {
  const nodes: DirectoryNode[] = [
    n({
      id: 'domain',
      type: 'container',
      dn: BASE,
      parentDn: null,
      name: 'contoso.lab',
      displayName: 'contoso.lab',
      sAMAccountName: 'contoso'
    }),
    n({
      id: 'cn-users',
      type: 'container',
      dn: `CN=Users,${BASE}`,
      parentDn: BASE,
      name: 'Users',
      displayName: 'Users',
      sAMAccountName: 'Users',
      description: 'Default users container'
    }),
    n({
      id: 'cn-computers',
      type: 'container',
      dn: `CN=Computers,${BASE}`,
      parentDn: BASE,
      name: 'Computers',
      displayName: 'Computers',
      sAMAccountName: 'Computers'
    }),
    n({
      id: 'cn-builtin',
      type: 'container',
      dn: `CN=Builtin,${BASE}`,
      parentDn: BASE,
      name: 'Builtin',
      displayName: 'Builtin',
      sAMAccountName: 'Builtin'
    }),
    n({
      id: 'ou-corp',
      type: 'ou',
      dn: `OU=Corp,${BASE}`,
      parentDn: BASE,
      name: 'Corp',
      displayName: 'Corp',
      sAMAccountName: 'Corp',
      description: 'Company root OU'
    }),
    n({
      id: 'ou-it',
      type: 'ou',
      dn: `OU=IT,OU=Corp,${BASE}`,
      parentDn: `OU=Corp,${BASE}`,
      name: 'IT',
      displayName: 'IT',
      sAMAccountName: 'IT'
    }),
    n({
      id: 'ou-fin',
      type: 'ou',
      dn: `OU=Finance,OU=Corp,${BASE}`,
      parentDn: `OU=Corp,${BASE}`,
      name: 'Finance',
      displayName: 'Finance',
      sAMAccountName: 'Finance'
    }),
    n({
      id: 'ou-ops',
      type: 'ou',
      dn: `OU=Operations,OU=Corp,${BASE}`,
      parentDn: `OU=Corp,${BASE}`,
      name: 'Operations',
      displayName: 'Operations',
      sAMAccountName: 'Operations'
    }),
    n({
      id: 'ou-groups',
      type: 'ou',
      dn: `OU=Groups,OU=Corp,${BASE}`,
      parentDn: `OU=Corp,${BASE}`,
      name: 'Groups',
      displayName: 'Groups',
      sAMAccountName: 'Groups',
      description: 'Role and nesting leftovers'
    })
  ]

  const user = (
    id: string,
    sam: string,
    display: string,
    parentDn: string,
    extra: Partial<DirectoryNode> = {}
  ): DirectoryNode =>
    n({
      id,
      type: 'user',
      dn: `CN=${display},${parentDn}`,
      parentDn,
      name: display,
      displayName: display,
      sAMAccountName: sam,
      userPrincipalName: `${sam}@contoso.lab`,
      mail: `${sam}@contoso.lab`,
      userAccountControl: UAC_NORMAL,
      lastLogonTimestamp: daysAgo(3),
      whenCreated: '2021-04-12T14:02:00.000Z',
      whenChanged: '2026-08-01T09:11:00.000Z',
      office: extra.office,
      ...extra
    })

  nodes.push(
    user('user-alice', 'achen', 'Alice Chen', `OU=IT,OU=Corp,${BASE}`, { office: 'HQ-2', description: 'IT operations' }),
    user('user-bob', 'bmartinez', 'Bob Martinez', `OU=Finance,OU=Corp,${BASE}`, {
      office: 'HQ-1',
      userAccountControl: UAC_DISABLED,
      description: 'Former AP clerk — disabled, still in Finance-App',
      lastLogonTimestamp: daysAgo(400)
    }),
    user('user-carol', 'csingh', 'Carol Singh', `OU=Finance,OU=Corp,${BASE}`, {
      office: 'Remote',
      lastLogonTimestamp: daysAgo(220),
      description: 'No logon in 7+ months'
    }),
    user('user-dave', 'dokonkwo', 'Dave Okonkwo', `OU=Finance,OU=Corp,${BASE}`, {
      office: 'HQ-1',
      description: 'Controller — in Finance and nested Finance-App'
    }),
    user('user-eve', 'ewalsh', 'Eve Walsh', `OU=IT,OU=Corp,${BASE}`, {
      office: 'HQ-2',
      description: 'Break-glass, direct Domain Admins',
      userAccountControl: UAC_NEVER_EXPIRE
    }),
    user('user-frank', 'flee', 'Frank Lee', `OU=IT,OU=Corp,${BASE}`, { office: 'HQ-2', description: 'Helpdesk' }),
    user('user-grace', 'gpatel', 'Grace Patel', `OU=Operations,OU=Corp,${BASE}`, { office: 'Warehouse' }),
    user('user-hank', 'hnguyen', 'Hank Nguyen', `OU=Operations,OU=Corp,${BASE}`, { office: 'Warehouse' }),
    user('user-irene', 'ikim', 'Irene Kim', `CN=Users,${BASE}`, {
      lastLogonTimestamp: null,
      description: 'Never logged on — contractor template leftover'
    }),
    user('user-james', 'jbrooks', 'James Brooks', `OU=IT,OU=Corp,${BASE}`, { office: 'HQ-2' }),
    user('user-kira', 'kross', 'Kira Ross', `OU=Finance,OU=Corp,${BASE}`, { office: 'HQ-1' }),
    user('user-leo', 'lmoreau', 'Leo Moreau', `OU=Operations,OU=Corp,${BASE}`, { office: 'Remote' })
  )

  const group = (
    id: string,
    sam: string,
    display: string,
    parentDn: string,
    groupType: number,
    description: string
  ): DirectoryNode =>
    n({
      id,
      type: 'group',
      dn: `CN=${display},${parentDn}`,
      parentDn,
      name: display,
      displayName: display,
      sAMAccountName: sam,
      groupType,
      description,
      whenCreated: '2019-01-08T10:00:00.000Z'
    })

  const usersCn = `CN=Users,${BASE}`
  const builtin = `CN=Builtin,${BASE}`
  const groupsOu = `OU=Groups,OU=Corp,${BASE}`

  nodes.push(
    group('g-da', 'Domain Admins', 'Domain Admins', usersCn, SECURITY_GLOBAL, 'Privileged — should be direct members only'),
    group('g-ea', 'Enterprise Admins', 'Enterprise Admins', usersCn, SECURITY_GLOBAL, 'Forest privileged'),
    group('g-sa', 'Schema Admins', 'Schema Admins', usersCn, SECURITY_GLOBAL, 'Schema privileged'),
    group('g-admins', 'Administrators', 'Administrators', builtin, SECURITY_DL, 'Builtin administrators'),
    group('g-du', 'Domain Users', 'Domain Users', usersCn, SECURITY_GLOBAL, 'Primary group for users'),
    group('g-it-admins', 'IT-Admins', 'IT-Admins', groupsOu, SECURITY_GLOBAL, 'Nested into Tier0 by accident'),
    group('g-tier0', 'Tier0', 'Tier0', groupsOu, SECURITY_GLOBAL, 'Should not contain nested role groups'),
    group('g-helpdesk', 'Helpdesk', 'Helpdesk', groupsOu, SECURITY_GLOBAL, 'Service desk'),
    group('g-finance', 'Finance', 'Finance', groupsOu, SECURITY_GLOBAL, 'Finance department'),
    group('g-finance-app', 'Finance-App', 'Finance-App', groupsOu, SECURITY_GLOBAL, 'Nested under Finance'),
    group('g-all-staff', 'All-Staff', 'All-Staff', groupsOu, DIST_GLOBAL, 'Mail distribution — nested into a security group'),
    group('g-corp-sec', 'Corp-Security', 'Corp-Security', groupsOu, SECURITY_GLOBAL, 'File share ACL group'),
    group('g-loop-a', 'Loop-A', 'Loop-A', groupsOu, SECURITY_GLOBAL, 'Part of a membership cycle'),
    group('g-loop-b', 'Loop-B', 'Loop-B', groupsOu, SECURITY_GLOBAL, 'Part of a membership cycle'),
    group('g-loop-c', 'Loop-C', 'Loop-C', groupsOu, SECURITY_GLOBAL, 'Part of a membership cycle'),
    group('g-d1', 'Depth-1', 'Depth-1', groupsOu, SECURITY_GLOBAL, 'Top of an overly deep nest'),
    group('g-d2', 'Depth-2', 'Depth-2', groupsOu, SECURITY_GLOBAL, ''),
    group('g-d3', 'Depth-3', 'Depth-3', groupsOu, SECURITY_GLOBAL, ''),
    group('g-d4', 'Depth-4', 'Depth-4', groupsOu, SECURITY_GLOBAL, ''),
    group('g-d5', 'Depth-5', 'Depth-5', groupsOu, SECURITY_GLOBAL, 'Five levels deep'),
    group('g-empty', 'Empty-Security', 'Empty-Security', groupsOu, SECURITY_GLOBAL, 'Created for a project that never launched')
  )

  nodes.push(
    n({
      id: 'pc-fs01',
      type: 'computer',
      dn: `CN=FS01,CN=Computers,${BASE}`,
      parentDn: `CN=Computers,${BASE}`,
      name: 'FS01',
      displayName: 'FS01',
      sAMAccountName: 'FS01$',
      operatingSystem: 'Windows Server 2019',
      lastLogonTimestamp: daysAgo(1),
      description: 'File server'
    }),
    n({
      id: 'pc-alice',
      type: 'computer',
      dn: `CN=WS-ALICE,OU=IT,OU=Corp,${BASE}`,
      parentDn: `OU=IT,OU=Corp,${BASE}`,
      name: 'WS-ALICE',
      displayName: 'WS-ALICE',
      sAMAccountName: 'WS-ALICE$',
      operatingSystem: 'Windows 11',
      lastLogonTimestamp: daysAgo(1)
    }),
    n({
      id: 'pc-bob',
      type: 'computer',
      dn: `CN=WS-BOB,OU=Finance,OU=Corp,${BASE}`,
      parentDn: `OU=Finance,OU=Corp,${BASE}`,
      name: 'WS-BOB',
      displayName: 'WS-BOB',
      sAMAccountName: 'WS-BOB$',
      operatingSystem: 'Windows 10',
      lastLogonTimestamp: daysAgo(400),
      description: 'Stale workstation for disabled user'
    })
  )

  const m = (from: string, to: string): DirectoryEdge => ({ from, to, via: 'member' })
  const edges: DirectoryEdge[] = [
    m('user-eve', 'g-da'),
    m('g-tier0', 'g-da'),
    m('g-it-admins', 'g-tier0'),
    m('user-alice', 'g-it-admins'),
    m('user-alice', 'g-helpdesk'),
    m('g-helpdesk', 'g-it-admins'),
    m('user-frank', 'g-helpdesk'),
    m('user-james', 'g-it-admins'),
    m('user-bob', 'g-finance-app'),
    m('user-dave', 'g-finance'),
    m('user-dave', 'g-finance-app'),
    m('g-finance-app', 'g-finance'),
    m('user-carol', 'g-finance'),
    m('user-carol', 'g-all-staff'),
    m('user-kira', 'g-finance'),
    m('user-grace', 'g-all-staff'),
    m('user-hank', 'g-all-staff'),
    m('user-leo', 'g-all-staff'),
    m('user-irene', 'g-all-staff'),
    m('g-all-staff', 'g-corp-sec'),
    m('g-loop-a', 'g-loop-b'),
    m('g-loop-b', 'g-loop-c'),
    m('g-loop-c', 'g-loop-a'),
    m('g-d5', 'g-d4'),
    m('g-d4', 'g-d3'),
    m('g-d3', 'g-d2'),
    m('g-d2', 'g-d1'),
    m('user-alice', 'g-d5')
  ]

  for (const u of nodes.filter((x) => x.type === 'user')) {
    edges.push({ from: u.id, to: 'g-du', via: 'primaryGroup' })
  }

  return { nodes, edges }
}

export function loadContosoFixture(): DirectorySnapshot {
  const { nodes, edges } = buildRaw()
  return enrichSnapshot({
    domain: 'contoso.lab',
    baseDn: BASE,
    source: 'fixture',
    dcHost: 'dc01.contoso.lab',
    protocol: 'ldaps',
    boundAs: 'sample\\directory',
    nodes,
    edges
  })
}
