import { FolderTree, Route, Sparkles, Waypoints, type LucideIcon } from 'lucide-react'
import type { WorkspaceId } from '@shared/types'

const ICON: Record<WorkspaceId, LucideIcon> = {
  directory: FolderTree,
  web: Waypoints,
  pathfinder: Route,
  hygiene: Sparkles
}

export function NavGlyph({ id }: { id: WorkspaceId }) {
  const Icon = ICON[id]
  return (
    <span className="nav-glyph" aria-hidden>
      <Icon size={15} strokeWidth={1.6} />
    </span>
  )
}
