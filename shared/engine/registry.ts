import { circularNesting } from './rules/circularNesting'
import { deepNesting } from './rules/deepNesting'
import { disabledInGroup } from './rules/disabledInGroup'
import { distributionInSecurity } from './rules/distributionInSecurity'
import { emptySecurityGroup } from './rules/emptySecurityGroup'
import { privilegedNestedPath } from './rules/privilegedNestedPath'
import { redundantMembership } from './rules/redundantMembership'
import { staleInGroup } from './rules/staleInGroup'
import type { Rule } from './rule'

/** Ordered rule set. Order is the order findings are reported in. */
export const RULES: readonly Rule[] = [
  circularNesting,
  deepNesting,
  emptySecurityGroup,
  disabledInGroup,
  staleInGroup,
  redundantMembership,
  privilegedNestedPath,
  distributionInSecurity
]
