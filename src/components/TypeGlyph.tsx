import { Box, Folder, Monitor, User, Users, type LucideIcon } from 'lucide-react'
import {
  Box as BoxSvg,
  Folder as FolderSvg,
  Monitor as MonitorSvg,
  User as UserSvg,
  Users as UsersSvg
} from 'lucide-static'
import type { DirectoryObjectType } from '@shared/types'

const ICON: Record<DirectoryObjectType, LucideIcon> = {
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

/** Lucide icon as a data URI for Cytoscape node images. `color` strokes the glyph. */
export function webNodeIcon(type: DirectoryObjectType, color = '#f6f8fb'): string {
  const svg = SVG[type]
    .replace(/\s+class="[^"]*"/, '')
    .replace('stroke="currentColor"', `stroke="${color}"`)
    .replace(/stroke-width="[^"]*"/, 'stroke-width="2"')
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function TypeGlyph({ type }: { type: DirectoryObjectType }) {
  const Icon = ICON[type]
  return (
    <span className={`glyph glyph-${type}`} aria-hidden>
      <Icon size={16} strokeWidth={1.9} />
    </span>
  )
}
