import {
  AtSign,
  Box,
  Cog,
  Folder,
  FolderTree,
  Globe,
  Layers,
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
/** Icon for an OU that reflects what it holds, so a folder of groups looks like groups. */
const BY_CONTENT: Partial<Record<DirectoryObjectType, LucideIcon>> = {
  group: Users,
  user: User,
  computer: Server
}

function containerIcon(node: DirectoryNode, contains?: DirectoryObjectType): LucideIcon {
  const rdn = node.dn.split(',')[0]?.replace(/^(CN|OU|DC)=/i, '').toLowerCase() ?? ''
  if (/^DC=/i.test(node.dn.split(',')[0] ?? '')) return Globe // the domain root itself
  if (rdn === 'builtin') return ShieldCheck
  if (rdn === 'users') return UsersRound
  if (rdn === 'computers') return Server
  if (rdn === 'domain controllers') return Server
  if (rdn === 'managed service accounts') return Cog
  if (node.type !== 'ou') return Box
  // One icon per level of nesting, so depth is legible from the glyph and not only indentation:
  // a top-level OU is a plain folder, one inside it stacked folders, anything deeper layers.
  const depth = (node.dn.match(/(^|,)OU=/gi) ?? []).length
  if (depth <= 1) return Folder
  if (depth === 2) return FolderTree
  return (contains && BY_CONTENT[contains]) ?? Layers
}

/**
 * The icon for an object, chosen from what it actually is rather than its bare type: a disabled
 * account, a distribution list, a privileged group and a plain user should not look alike.
 */
export function iconFor(node: DirectoryNode, contains?: DirectoryObjectType): LucideIcon {
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
      return containerIcon(node, contains)
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
export function TypeGlyph({
  type,
  node,
  contains
}: {
  type: DirectoryObjectType
  node?: DirectoryNode
  /** For containers: the kind of object it mostly holds. */
  contains?: DirectoryObjectType
}) {
  const Icon = node ? iconFor(node, contains) : BY_TYPE[type]
  return (
    <span className={`glyph glyph-${type}`} aria-hidden>
      <Icon size={16} strokeWidth={1.9} />
    </span>
  )
}
