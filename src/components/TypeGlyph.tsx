import {
  AtSign,
  Box,
  Cog,
  Folder,
  Globe,
  Laptop,
  Monitor,
  Server,
  ShieldAlert,
  ShieldCheck,
  User,
  UserRoundX,
  Users,
  UsersRound,
  type LucideIcon
} from 'lucide-react'
import {
  Monitor as MonitorSvg,
  User as UserSvg,
  Users as UsersSvg,
  Box as BoxSvg,
  Folder as FolderSvg
} from 'lucide-static'
import { isDisabled, isSecurityGroup } from '@shared/adFlags'
import type { DirectoryNode, DirectoryObjectType } from '@shared/types'

/** Fallback when only the bare type is known. */
const BY_TYPE: Record<DirectoryObjectType, LucideIcon> = {
  user: User,
  group: Users,
  computer: Monitor,
  ou: Folder,
  container: Box
}

const SVG: Record<DirectoryObjectType, string> = {
  user: UserSvg,
  group: UsersSvg,
  computer: MonitorSvg,
  ou: FolderSvg,
  container: BoxSvg
}

/** Well-known containers get the icon an admin expects, the way ADUC distinguishes them. */
function containerIcon(node: DirectoryNode): LucideIcon {
  const rdn = node.dn.split(',')[0]?.replace(/^(CN|OU|DC)=/i, '').toLowerCase() ?? ''
  if (/^DC=/i.test(node.dn.split(',')[0] ?? '')) return Globe // the domain root itself
  if (rdn === 'builtin') return ShieldCheck
  if (rdn === 'users') return UsersRound
  if (rdn === 'computers') return Server
  if (rdn === 'domain controllers') return Server
  if (rdn === 'managed service accounts') return Cog
  return node.type === 'ou' ? Folder : Box
}

/**
 * The icon for an object, chosen from what it actually is rather than its bare type: a disabled
 * account, a distribution list, a privileged group and a plain user should not look alike.
 */
export function iconFor(node: DirectoryNode): LucideIcon {
  switch (node.type) {
    case 'user':
      return isDisabled(node.userAccountControl) ? UserRoundX : User
    case 'group':
      if (node.privileged) return ShieldAlert
      return node.groupType !== undefined && !isSecurityGroup(node.groupType) ? AtSign : Users
    case 'computer':
      return /server/i.test(node.operatingSystem ?? '') ? Server : Laptop
    case 'ou':
    case 'container':
      return containerIcon(node)
  }
}

/** Lucide icon as a data URI for Cytoscape node images. `color` strokes the glyph. */
export function webNodeIcon(type: DirectoryObjectType, color = '#f6f8fb'): string {
  const svg = SVG[type]
    .replace(/\s+class="[^"]*"/, '')
    .replace('stroke="currentColor"', `stroke="${color}"`)
    .replace(/stroke-width="[^"]*"/, 'stroke-width="2"')
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Pass `node` for the specific icon; `type` alone falls back to the generic one. */
export function TypeGlyph({ type, node }: { type: DirectoryObjectType; node?: DirectoryNode }) {
  const Icon = node ? iconFor(node) : BY_TYPE[type]
  return (
    <span className={`glyph glyph-${type}`} aria-hidden>
      <Icon size={16} strokeWidth={1.9} />
    </span>
  )
}
