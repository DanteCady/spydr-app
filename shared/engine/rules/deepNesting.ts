import { defineRule } from '../rule'

export const deepNesting = defineRule({
  id: 'deep-nesting',
  name: 'Deep nesting',
  severity: 'high',
  describe: 'Groups nested more levels deep than the configured limit, outside of reported cycles.',
  detect: (ctx) => {
    const limit = ctx.config.deepNesting
    const out = []
    for (const id of ctx.groups) {
      if (ctx.inCycle.has(id)) continue // the cycle finding already covers these
      const depth = ctx.depth.get(id)
      if (depth === undefined || depth <= limit) continue
      out.push({
        id: `deep-${id}`,
        type: 'deep-nesting' as const,
        severity: 'high' as const,
        title: `Nesting depth ${depth} (limit ${limit})`,
        objectIds: [id],
        detail: `${ctx.label(id)} sits ${depth} groups above its deepest nested member chain.`,
        suggestedFix:
          'Flatten the chain. Nesting more than three groups deep is hard to audit and often leftover from old role groups. Prefer one role group and direct members.'
      })
    }
    return out
  }
})
