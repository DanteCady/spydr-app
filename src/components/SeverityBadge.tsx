import type { FindingSeverity } from '@shared/types'
import { severityLabel } from '../lib/format'

const SHAPES: Record<FindingSeverity, string> = {
  critical: 'M8 1.5 14.5 8 8 14.5 1.5 8z',
  high: 'M8 2.5 14.5 13.5H1.5z',
  medium: 'M2.5 2.5h11v11h-11z',
  low: 'M8 8m-5.5 0a5.5 5.5 0 1 0 11 0 5.5 5.5 0 1 0-11 0'
}

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span className={`badge severity ${severity}`}>
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d={SHAPES[severity]} />
      </svg>
      {severityLabel(severity)}
    </span>
  )
}
