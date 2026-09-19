import type { DirectoryNode, DirectoryObjectType, FindingSeverity } from '@shared/types'
import { isDisabled, isStale } from '@shared/adFlags'

export function typeLabel(type: DirectoryObjectType): string {
  switch (type) {
    case 'user':
      return 'User'
    case 'group':
      return 'Group'
    case 'ou':
      return 'Organizational Unit'
    case 'computer':
      return 'Computer'
    case 'container':
      return 'Container'
  }
}

export function formatWhen(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatLogon(ts?: number | null): string {
  if (ts == null || ts === 0) return 'Never'
  const d = new Date(ts)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function uacSummary(node: DirectoryNode): string[] {
  const flags: string[] = []
  if (isDisabled(node.userAccountControl)) flags.push('Disabled')
  if (node.userAccountControl !== undefined && node.userAccountControl & 0x0010) flags.push('Locked')
  if (node.userAccountControl !== undefined && node.userAccountControl & 0x10000) flags.push('Password never expires')
  if (isStale(node.lastLogonTimestamp) && node.type === 'user' && !isDisabled(node.userAccountControl)) flags.push('Stale')
  return flags
}

export function severityLabel(s: FindingSeverity): string {
  return s[0].toUpperCase() + s.slice(1)
}

export function groupScope(groupType?: number): string {
  if (groupType === undefined) return '—'
  const security = Boolean(groupType & 0x80000000)
  const kind = groupType & 0x0000000f
  const scope = kind === 2 ? 'Global' : kind === 4 ? 'Domain local' : kind === 8 ? 'Universal' : 'Unknown'
  return `${scope} ${security ? 'security' : 'distribution'}`
}

/** "just now", "4 minutes ago", "2 hours ago" — how stale the open snapshot is, at a glance. */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
