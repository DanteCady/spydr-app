import { enumeratePaths } from '../../graph'
import { defineRule } from '../rule'

export const privilegedNestedPath = defineRule({
  id: 'privileged-nested-path',
  name: 'Nested path into a privileged group',
  severity: 'critical',
  describe: 'Users who reach a privileged group through nested groups rather than direct membership.',
  why:
    'The member list of Domain Admins will not show these people. Access reviews read that list, so a nested path is privilege that survives the review that was meant to catch it.',
  detect: (ctx) => {
    const out = []
    for (const user of ctx.users) {
      for (const g of ctx.privileged) {
        const paths = enumeratePaths(ctx.graph, user.id, g.id, { maxDepth: 8, maxPaths: ctx.config.maxPrivilegedPaths })
        const nested = paths.filter((p) => p.nodeIds.length > 2)
        if (nested.length === 0) continue
        out.push({
          id: `priv-${user.id}-${g.id}`,
          type: 'privileged-nested-path' as const,
          severity: 'critical' as const,
          title: `Nested path to ${g.sAMAccountName}`,
          objectIds: [...new Set(nested.flatMap((p) => p.nodeIds))],
          detail: nested.map((p) => p.labels.join(' → ')).join(' | '),
          suggestedFix: `Review why ${user.displayName} reaches ${g.displayName} through nested groups. Privileged groups should have direct, named members only.`
        })
      }
    }
    return out
  }
})
