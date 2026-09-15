import { isDisabled, isStale } from '@shared/adFlags'
import type { DirectoryNode } from '@shared/types'

function Badge({ kind, path, label }: { kind: string; path: string; label: string }) {
  return (
    <span className={`badge status ${kind}`}>
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d={path} />
      </svg>
      {label}
    </span>
  )
}

const SHIELD = 'M8 1.5 13.5 3.6v4.2c0 3.4-2.2 5.7-5.5 6.9-3.3-1.2-5.5-3.5-5.5-6.9V3.6z'
const SLASH_CIRCLE = 'M8 8m-6 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0M3.8 3.8l8.4 8.4'
const CLOCK = 'M8 8m-6 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0M8 4.4V8l2.6 1.6'

export function StatusBadges({ node }: { node: DirectoryNode }) {
  return (
    <>
      {node.privileged ? <Badge kind="privileged" path={SHIELD} label="Privileged" /> : null}
      {isDisabled(node.userAccountControl) ? <Badge kind="disabled" path={SLASH_CIRCLE} label="Disabled" /> : null}
      {node.type === 'user' && isStale(node.lastLogonTimestamp) && !isDisabled(node.userAccountControl) ? (
        <Badge kind="stale" path={CLOCK} label="Stale" />
      ) : null}
    </>
  )
}
