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

export function isPrivilegedSam(sam: string): boolean {
  return PRIVILEGED_SAM.has(sam.trim().toLowerCase())
}
