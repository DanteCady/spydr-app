import { isDisabled, isStale } from '@shared/adFlags'
import type { DirectoryNode } from '@shared/types'

export function StatusBadges({ node }: { node: DirectoryNode }) {
  return (
    <>
      {node.privileged ? <span className="badge privileged">Privileged</span> : null}
      {isDisabled(node.userAccountControl) ? <span className="badge disabled">Disabled</span> : null}
      {node.type === 'user' && isStale(node.lastLogonTimestamp) && !isDisabled(node.userAccountControl) ? (
        <span className="badge stale">Stale</span>
      ) : null}
    </>
  )
}
