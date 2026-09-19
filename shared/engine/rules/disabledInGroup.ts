import { defineRule } from '../rule'

export const disabledInGroup = defineRule({
  id: 'disabled-in-group',
  name: 'Disabled user still in groups',
  severity: 'medium',
  describe: 'Disabled accounts that still hold explicit group memberships.',
  why:
    'A disabled account is not a revoked one. Re-enable it — a helpdesk restore, a returning contractor — and every membership it kept comes back with it, silently.',
  detect: (ctx) => {
    const out = []
    for (const n of ctx.users) {
      if (ctx.isBuiltin(n) || !ctx.isDisabled(n)) continue
      const groups = ctx.memberEdgesToGroups.get(n.id) ?? []
      if (groups.length === 0) continue
      out.push({
        id: `disabled-${n.id}`,
        type: 'disabled-in-group' as const,
        severity: 'medium' as const,
        title: 'Disabled user still in groups',
        objectIds: [n.id, ...groups.map((e) => e.to)],
        detail: `${n.displayName} is disabled but remains in ${groups.map((e) => ctx.label(e.to)).join(', ')}.`,
        suggestedFix:
          'Remove the disabled account from application and role groups (leave Domain Users). Disabled members still appear in nested token expansion and confuse access reviews.'
      })
    }
    return out
  }
})
