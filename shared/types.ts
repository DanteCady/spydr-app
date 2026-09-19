export type DirectoryObjectType = 'user' | 'group' | 'ou' | 'computer' | 'container'

export type Protocol = 'ldap' | 'ldaps' | 'starttls'

export type WorkspaceId = 'directory' | 'web' | 'pathfinder' | 'hygiene' | 'settings' | 'help'

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'

export type FindingType =
  | 'circular-nesting'
  | 'deep-nesting'
  | 'empty-security-group'
  | 'disabled-in-group'
  | 'stale-in-group'
  | 'redundant-membership'
  | 'privileged-nested-path'
  | 'distribution-in-security'

export interface DirectoryNode {
  id: string
  type: DirectoryObjectType
  dn: string
  parentDn: string | null
  name: string
  displayName: string
  sAMAccountName: string
  description: string
  mail?: string
  userPrincipalName?: string
  office?: string
  userAccountControl?: number
  lastLogonTimestamp?: number | null
  whenCreated?: string
  whenChanged?: string
  groupType?: number
  managedBy?: string
  operatingSystem?: string
  primaryGroupId?: number
  privileged?: boolean
}

export interface DirectoryEdge {
  from: string
  to: string
  via: 'member' | 'primaryGroup'
}

export interface Finding {
  id: string
  type: FindingType
  severity: FindingSeverity
  title: string
  objectIds: string[]
  detail: string
  suggestedFix: string
}

export interface SnapshotStats {
  users: number
  groups: number
  ous: number
  computers: number
  edges: number
  findings: number
  hygieneScore: number
}

export interface DirectorySnapshot {
  domain: string
  baseDn: string
  ingestedAt: string
  source: 'ldap' | 'fixture'
  dcHost?: string
  protocol?: Protocol
  boundAs?: string
  nodes: DirectoryNode[]
  edges: DirectoryEdge[]
  findings: Finding[]
  stats: SnapshotStats
}

export interface ConnectionProfile {
  id: string
  name: string
  domain: string
  host: string
  port: number
  protocol: Protocol
  bindUsername: string
  trustServerCert: boolean
  baseDn: string
  rememberPassword: boolean
  lastIngestAt?: string
}

export interface ConnectionInput {
  profileId?: string
  name?: string
  domain: string
  host: string
  port: number
  protocol: Protocol
  bindUsername: string
  password: string
  trustServerCert: boolean
  baseDn: string
  rememberPassword: boolean
}

export interface TestConnectionResult {
  ok: true
  dnsHostName: string
  defaultNamingContext: string
  boundAs: string
  protocol: Protocol
  domainFunctionality?: string
}

export interface DiscoverResult {
  domain?: string
  host?: string
  sources: string[]
}

export interface DcRecord {
  name: string
  port: number
  priority: number
}

export interface PathResult {
  nodeIds: string[]
  labels: string[]
}

export interface IngestProgress {
  phase: string
  count?: number
  detail?: string
}

export interface WindowsPrefill {
  domain?: string
  host?: string
  netbios?: string
}
