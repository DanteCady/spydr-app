import type { WorkspaceId } from '@shared/types'

const PATHS: Record<WorkspaceId, string> = {
  directory: 'M3 3.5h4l1.2 1.6H13v8H3zM3 7.2h10',
  web: 'M8 8m-1.7 0a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 1 0-3.4 0M8 6.3V2.8M9.5 8.8l3.3 2.4M6.5 8.8l-3.3 2.4M8 2.8m-1.3 0a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0M13.2 11.6m-1.3 0a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0M2.8 11.6m-1.3 0a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0',
  pathfinder: 'M3 13V9.5a2 2 0 0 1 2-2h6a2 2 0 0 0 2-2V3M3 13m-1.4 0a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0M13 3m-1.4 0a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0',
  hygiene: 'M8 1.8l1.5 4 4.2.3-3.2 2.7 1 4.1L8 10.6l-3.5 2.3 1-4.1L2.3 6.1l4.2-.3z'
}

export function NavGlyph({ id }: { id: WorkspaceId }) {
  return (
    <span className="nav-glyph" aria-hidden>
      <svg viewBox="0 0 16 16">
        <path d={PATHS[id]} />
      </svg>
    </span>
  )
}
