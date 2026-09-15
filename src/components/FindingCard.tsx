import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Finding } from '@shared/types'
import { SeverityBadge } from './SeverityBadge'

export function FindingCard({
  finding,
  onDismiss,
  children
}: {
  finding: Finding
  onDismiss?: () => void
  children?: ReactNode
}) {
  return (
    <div className="path-card finding-card">
      <div className="finding-head">
        <SeverityBadge severity={finding.severity} />
        <span className="finding-title">{finding.title}</span>
        {onDismiss ? (
          <button type="button" className="dismiss" aria-label="Dismiss finding" onClick={onDismiss}>
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </div>
      <p>{finding.detail}</p>
      <p className="suggested">{finding.suggestedFix}</p>
      {children}
    </div>
  )
}
