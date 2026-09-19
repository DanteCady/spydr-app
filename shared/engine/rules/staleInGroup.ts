import { defineRule } from '../rule'

export const staleInGroup = defineRule({
  id: 'stale-in-group',
  name: 'Stale user still in groups',
  severity: 'medium',
  describe: 'Enabled accounts with no recent logon that still hold group memberships.',
  why:
    'An account nobody has used in months is an account nobody would notice being used. Its memberships are the blast radius if it is ever compromised.',
  detect: (ctx) => {
    const out = []
    for (const n of ctx.users) {
      if (ctx.isBuiltin(n) || ctx.isDisabled(n) || !ctx.isStale(n.lastLogonTimestamp)) continue
      const groups = ctx.memberEdgesToGroups.get(n.id) ?? []
      if (groups.length === 0) continue
      out.push({
        id: `stale-${n.id}`,
        type: 'stale-in-group' as const,
        severity: 'medium' as const,
        title: 'Stale user still in groups',
        objectIds: [n.id, ...groups.map((e) => e.to)],
        detail: `${n.displayName} has no logon in ${ctx.config.staleDays}+ days (or never) and is still in ${groups.map((e) => ctx.label(e.to)).join(', ')}.`,
        suggestedFix:
          'Confirm the account is unused, then disable it and strip role-group membership. Stale members are a common source of leftover access in small directories.'
      })
    }
    return out
  }
})
