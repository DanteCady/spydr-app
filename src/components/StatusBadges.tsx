import { Ban, Clock, ShieldAlert, type LucideIcon } from 'lucide-react'
import { isDisabled, isStale } from '@shared/adFlags'
import type { DirectoryNode } from '@shared/types'

function Badge({ kind, icon: Icon, label }: { kind: string; icon: LucideIcon; label: string }) {
  return (
    <span className={`badge status ${kind}`}>
      <Icon size={10} strokeWidth={2.2} aria-hidden />
      {label}
    </span>
  )
}

export function StatusBadges({ node }: { node: DirectoryNode }) {
  return (
    <>
      {node.privileged ? <Badge kind="privileged" icon={ShieldAlert} label="Privileged" /> : null}
      {isDisabled(node.userAccountControl) ? <Badge kind="disabled" icon={Ban} label="Disabled" /> : null}
      {node.type === 'user' && isStale(node.lastLogonTimestamp) && !isDisabled(node.userAccountControl) ? (
        <Badge kind="stale" icon={Clock} label="Stale" />
      ) : null}
    </>
  )
}
