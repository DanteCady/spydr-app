import { defineRule } from '../rule'

export const distributionInSecurity = defineRule({
  id: 'distribution-in-security',
  name: 'Distribution group nested in a security group',
  severity: 'high',
  describe: 'Mail distribution groups nested inside security groups, where they can grant access.',
  detect: (ctx) => {
    const out = []
    for (const edge of ctx.edges) {
      const from = ctx.byId.get(edge.from)
      const to = ctx.byId.get(edge.to)
      if (!from || !to || from.type !== 'group' || to.type !== 'group') continue
      if (!ctx.isDistributionGroup(from) || !ctx.isSecurityGroup(to)) continue
      out.push({
        id: `distsec-${from.id}-${to.id}`,
        type: 'distribution-in-security' as const,
        severity: 'high' as const,
        title: 'Distribution group nested in a security group',
        objectIds: [from.id, to.id],
        detail: `${from.displayName} (distribution) is a member of ${to.displayName} (security).`,
        suggestedFix:
          'Do not nest distribution groups into security groups. Mail-enabled dist groups are not meant to grant access. Create a security group for the role and keep the dist group for email only.'
      })
    }
    return out
  }
})
