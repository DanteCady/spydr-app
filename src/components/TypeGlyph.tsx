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

/** Icon for an OU that reflects what it holds, so a folder of groups looks like groups. */
const BY_CONTENT: Partial<Record<DirectoryObjectType, LucideIcon>> = {
  group: Users,
  user: User,
  computer: Server
}

/** The icon plus the type whose colour it should take. */
export interface Glyph {
  Icon: LucideIcon
  tone: DirectoryObjectType
}

/** Well-known containers get the icon an admin expects, the way ADUC distinguishes them. */
function containerGlyph(node: DirectoryNode, contains?: DirectoryObjectType): Glyph {
  const own = node.type
  const rdn = node.dn.split(',')[0]?.replace(/^(CN|OU|DC)=/i, '').toLowerCase() ?? ''
  if (/^DC=/i.test(node.dn.split(',')[0] ?? '')) return { Icon: Globe, tone: own } // the domain root
  if (rdn === 'builtin') return { Icon: ShieldCheck, tone: own }
  if (rdn === 'users') return { Icon: UsersRound, tone: own }
  if (rdn === 'computers') return { Icon: Server, tone: own }
  if (rdn === 'domain controllers') return { Icon: Server, tone: own }
  if (rdn === 'managed service accounts') return { Icon: Cog, tone: own }
  if (node.type !== 'ou') return { Icon: Box, tone: own }
  // One icon per level of nesting, so depth is legible from the glyph and not only indentation:
  // a top-level OU is a plain folder, one inside it stacked folders, anything deeper takes the
  // shape and the colour of whatever it holds.
  const depth = (node.dn.match(/(^|,)OU=/gi) ?? []).length
  if (depth <= 1) return { Icon: Folder, tone: own }
  if (depth === 2) return { Icon: FolderTree, tone: own }
  const byContent = contains && BY_CONTENT[contains]
  return byContent ? { Icon: byContent, tone: contains } : { Icon: Layers, tone: own }
}

/**
 * The icon for an object, chosen from what it actually is rather than its bare type: a disabled
 * account, a distribution list, a privileged group and a plain user should not look alike.
 */
export function glyphFor(node: DirectoryNode, contains?: DirectoryObjectType): Glyph {
  switch (node.type) {
    case 'user':
      return { Icon: isDisabled(node.userAccountControl) ? UserRoundX : User, tone: 'user' }
    case 'group':
      if (node.privileged) return { Icon: ShieldAlert, tone: 'group' }
      return {
        Icon: node.groupType !== undefined && !isSecurityGroup(node.groupType) ? AtSign : Users,
        tone: 'group'
      }
    case 'computer':
      return { Icon: /server/i.test(node.operatingSystem ?? '') ? Server : Laptop, tone: 'computer' }
    case 'ou':
    case 'container':
      return containerGlyph(node, contains)
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
  const { Icon, tone } = node ? glyphFor(node, contains) : { Icon: BY_TYPE[type], tone: type }
  return (
    <span className={`glyph glyph-${tone}`} aria-hidden>
      <Icon size={16} strokeWidth={1.9} />
    </span>
  )
}
