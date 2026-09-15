import { useMemo, useState } from 'react'
import type { FindingSeverity, FindingType } from '@shared/types'
import { SeverityBadge } from '../components/SeverityBadge'
import { useApp } from '../state'

const TYPES: { id: FindingType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'circular-nesting', label: 'Cycles' },
  { id: 'privileged-nested-path', label: 'Privileged paths' },
  { id: 'deep-nesting', label: 'Deep nesting' },
  { id: 'disabled-in-group', label: 'Disabled' },
  { id: 'stale-in-group', label: 'Stale' },
  { id: 'empty-security-group', label: 'Empty' },
  { id: 'redundant-membership', label: 'Redundant' },
  { id: 'distribution-in-security', label: 'Dist in security' }
]

export function Hygiene() {
  const { snapshot, goToFinding } = useApp()
  const [type, setType] = useState<FindingType | 'all'>('all')

  const findings = snapshot?.findings ?? []
  const filtered = useMemo(
    () => (type === 'all' ? findings : findings.filter((f) => f.type === type)),
    [findings, type]
  )

  if (!snapshot) return null

  const count = (s: FindingSeverity) => findings.filter((f) => f.severity === s).length

  return (
    <div className="hygiene">
      <div className="metrics">
        <div className="metric score">
          <div className="n">{snapshot.stats.hygieneScore}<span className="unit">/100</span></div>
          <div className="l">Hygiene score</div>
        </div>
        <div className="metric">
          <div className="n">{findings.length}</div>
          <div className="l">Findings</div>
        </div>
        <div className="metric">
          <div className="n">{count('critical')}</div>
          <div className="l">Critical</div>
        </div>
        <div className="metric">
          <div className="n">{findings.filter((f) => f.type === 'circular-nesting').length}</div>
          <div className="l">Cycles</div>
        </div>
        <div className="metric">
          <div className="n">{findings.filter((f) => f.type === 'privileged-nested-path').length}</div>
          <div className="l">Privileged nested paths</div>
        </div>
      </div>
      <div className="toolbar chips">
        {TYPES.map((t) => {
          const n = t.id === 'all' ? findings.length : findings.filter((f) => f.type === t.id).length
          return (
            <button
              key={t.id}
              type="button"
              className={type === t.id ? 'chip active' : 'chip'}
              aria-pressed={type === t.id}
              onClick={() => setType(t.id)}
            >
              {t.label}
              <span className="chip-n">{n}</span>
            </button>
          )
        })}
      </div>
      <div className="scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Finding</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr
                key={f.id}
                onClick={() => goToFinding(f)}
              >
                <td>
                  <SeverityBadge severity={f.severity} />
                </td>
                <td>{f.title}</td>
                <td className="muted">{f.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
