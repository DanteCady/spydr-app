import { CircleAlert, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { FindingSeverity } from '@shared/types'
import { severityLabel } from '../lib/format'

// Distinct shapes per severity so the level reads without relying on color.
const ICON: Record<FindingSeverity, LucideIcon> = {
  critical: OctagonAlert,
  high: TriangleAlert,
  medium: CircleAlert,
  low: Info
}

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  const Icon = ICON[severity]
  return (
    <span className={`badge severity ${severity}`}>
      <Icon size={10} strokeWidth={2.4} aria-hidden />
      {severityLabel(severity)}
    </span>
  )
}
