import { defineRule } from '../rule'

export const redundantMembership = defineRule({
  id: 'redundant-membership',
  name: 'Redundant direct membership',
  severity: 'low',
  describe: 'A user who is a direct member of both a group and one of its nested member groups.',
  why:
    'Removing the obvious membership looks like revoking access and does not, because the nested one still grants it. This is how offboarding quietly fails.',
  detect: (ctx) => {
    const out = []
    for (const user of ctx.users) {
      const direct = ctx.memberOf.get(user.id) ?? []
      const directSet = new Set(direct)
      for (const g of direct) {
        if (!ctx.groups.has(g) || !ctx.graph.hasNode(g)) continue
        for (const nested of ctx.graph.inNeighbors(g)) {
          if (!ctx.groups.has(nested) || nested === g || !directSet.has(nested)) continue
          out.push({
            id: `redundant-${user.id}-${g}-${nested}`,
            type: 'redundant-membership' as const,
            severity: 'low' as const,
            title: 'Redundant direct membership',
            objectIds: [user.id, nested, g],
            detail: `${user.displayName} is a direct member of ${ctx.label(g)} and of nested group ${ctx.label(nested)}.`,
            suggestedFix: `Remove the user from the parent (${ctx.label(g)}) or from the nested group — not both. Keep the membership that matches the actual role.`
          })
        }
      }
    }
    return out
  }
})
