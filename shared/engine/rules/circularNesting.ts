import { defineRule } from '../rule'

export const circularNesting = defineRule({
  id: 'circular-nesting',
  name: 'Circular group nesting',
  severity: 'critical',
  describe: 'A chain of nested groups that loops back on itself.',
  why:
    'Effective membership becomes unanswerable: each group grants the others\' access, and token expansion can loop. Nobody can say what the chain actually confers, so nobody safely changes it.',
  detect: (ctx) =>
    ctx.cycles.map((cycle, i) => ({
      id: `circular-${i}`,
      type: 'circular-nesting' as const,
      severity: 'critical' as const,
      title: 'Circular group nesting',
      objectIds: cycle,
      detail: cycle.map((id) => ctx.label(id)).join(' → ') + ` → ${ctx.label(cycle[0])}`,
      suggestedFix:
        'Break the loop in Active Directory Users and Computers: remove one nested member so the chain is a tree. Circular nesting makes effective membership unpredictable and can loop token evaluation.'
    }))
})
