import { defineRule } from '../rule'

export const emptySecurityGroup = defineRule({
  id: 'empty-security-group',
  name: 'Empty security group',
  severity: 'low',
  describe: 'Security groups with no members at all, excluding the ones AD creates itself.',
  detect: (ctx) =>
    ctx.nodes
      .filter(
        (n) =>
          n.type === 'group' &&
          ctx.isSecurityGroup(n) &&
          !ctx.isBuiltin(n) &&
          (ctx.membersOf.get(n.id)?.length ?? 0) === 0
      )
      .map((n) => ({
        id: `empty-${n.id}`,
        type: 'empty-security-group' as const,
        severity: 'low' as const,
        title: 'Empty security group',
        objectIds: [n.id],
        detail: `${n.displayName} is a security group with no members.`,
        suggestedFix:
          'If unused, document and delete it after checking delegated ACLs and file shares. Empty groups linger and get reused by mistake.'
      }))
})
