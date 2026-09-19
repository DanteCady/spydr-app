import { FolderTree, Route, Settings2, Sparkles } from 'lucide-react'
import type { ComponentType } from 'react'
import type { WorkspaceId } from '@shared/types'

type GlyphProps = { size?: number; strokeWidth?: number }

/** Spider web in Lucide's line style: eight spokes with two sagging rings. Lucide has no web glyph. */
function SpiderWeb({ size = 15, strokeWidth = 1.6 }: GlyphProps) {
  const spokes = 8
  const ring = (r: number, sag: number): string => {
    const pt = (i: number, rad: number): [number, number] => {
      const a = (i / spokes) * Math.PI * 2 - Math.PI / 2
      return [12 + Math.cos(a) * rad, 12 + Math.sin(a) * rad]
    }
    let d = ''
    for (let i = 0; i < spokes; i++) {
      const [x0, y0] = pt(i, r)
      const [x1, y1] = pt(i + 1, r)
      const [cx, cy] = pt(i + 0.5, sag)
      d += (i === 0 ? `M${x0.toFixed(2)} ${y0.toFixed(2)}` : '') + ` Q${cx.toFixed(2)} ${cy.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`
    }
    return d + 'Z'
  }
  const spokePaths = Array.from({ length: spokes }, (_, i) => {
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2
    return `M12 12L${(12 + Math.cos(a) * 10.5).toFixed(2)} ${(12 + Math.sin(a) * 10.5).toFixed(2)}`
  }).join('')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={spokePaths} />
      <path d={ring(10, 8.4)} />
      <path d={ring(5.6, 4.4)} />
    </svg>
  )
}

const ICON: Record<WorkspaceId, ComponentType<GlyphProps>> = {
  directory: FolderTree,
  web: SpiderWeb,
  pathfinder: Route,
  hygiene: Sparkles,
  settings: Settings2
}

export function NavGlyph({ id }: { id: WorkspaceId }) {
  const Icon = ICON[id]
  return (
    <span className="nav-glyph" aria-hidden>
      <Icon size={15} strokeWidth={1.6} />
    </span>
  )
}
