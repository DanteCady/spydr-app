export const UAC_ACCOUNTDISABLE = 0x0002
export const UAC_LOCKOUT = 0x0010
export const UAC_DONT_EXPIRE_PASSWORD = 0x10000
export const GROUP_TYPE_SECURITY = 0x80000000

export function isDisabled(uac?: number): boolean {
  return Boolean(uac !== undefined && uac & UAC_ACCOUNTDISABLE)
}

export function isLocked(uac?: number): boolean {
  return Boolean(uac !== undefined && uac & UAC_LOCKOUT)
}

export function passwordNeverExpires(uac?: number): boolean {
  return Boolean(uac !== undefined && uac & UAC_DONT_EXPIRE_PASSWORD)
}

export function isSecurityGroup(groupType?: number): boolean {
  if (groupType === undefined) return false
  return Boolean(groupType & GROUP_TYPE_SECURITY)
}

export function isDistributionGroup(groupType?: number): boolean {
  if (groupType === undefined) return false
  return !isSecurityGroup(groupType)
}

export const STALE_MS = 90 * 24 * 60 * 60 * 1000

export function isStale(lastLogonTimestamp: number | null | undefined, now = Date.now()): boolean {
  if (lastLogonTimestamp == null || lastLogonTimestamp === 0) return true
  return now - lastLogonTimestamp > STALE_MS
}

export const PRIVILEGED_SAM = new Set([
  'domain admins',
  'enterprise admins',
  'schema admins',
  'administrators'
])

export function isPrivilegedSam(sam: string, extra: readonly string[] = []): boolean {
  const key = sam.trim().toLowerCase()
  if (PRIVILEGED_SAM.has(key)) return true
  // Tier-0 groups in a real forest are rarely called "Domain Admins"; the admin names their own.
  return extra.some((name) => name.trim().toLowerCase() === key)
}

/**
 * Groups and accounts Active Directory creates itself. They are excluded from cleanup findings
 * (an empty Cryptographic Operators is normal, not mess) but never from privilege analysis —
 * Domain Admins is built-in and still the thing we care most about.
 */
export const BUILTIN_GROUP_SAM = new Set([
  'domain admins', 'domain users', 'domain guests', 'domain computers', 'domain controllers',
  'enterprise admins', 'schema admins', 'group policy creator owners', 'cert publishers',
  'read-only domain controllers', 'enterprise read-only domain controllers', 'dnsadmins',
  'dnsupdateproxy', 'ras and ias servers', 'allowed rodc password replication group',
  'denied rodc password replication group', 'protected users', 'key admins', 'enterprise key admins',
  'cloneable domain controllers', 'administrators', 'users', 'guests', 'account operators',
  'server operators', 'print operators', 'backup operators', 'replicator', 'remote desktop users',
  'network configuration operators', 'performance monitor users', 'performance log users',
  'distributed com users', 'iis_iusrs', 'cryptographic operators', 'event log readers',
  'certificate service dcom access', 'rds remote access servers', 'rds endpoint servers',
  'rds management servers', 'hyper-v administrators', 'access control assistance operators',
  'remote management users', 'storage replica administrators', 'terminal server license servers',
  'pre-windows 2000 compatible access', 'incoming forest trust builders',
  'windows authorization access group'
])

export const BUILTIN_ACCOUNT_SAM = new Set([
  'administrator', 'guest', 'krbtgt', 'defaultaccount', 'wdagutilityaccount'
])

export function isBuiltinGroup(sAMAccountName: string, dn: string): boolean {
  if (/,CN=Builtin,/i.test(dn)) return true
  return BUILTIN_GROUP_SAM.has(sAMAccountName.trim().toLowerCase())
}

export function isBuiltinAccount(sAMAccountName: string): boolean {
  return BUILTIN_ACCOUNT_SAM.has(sAMAccountName.trim().toLowerCase())
}
