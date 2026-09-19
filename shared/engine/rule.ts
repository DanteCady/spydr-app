import type { Finding, FindingSeverity, FindingType } from '../types'
import type { EngineContext } from './context'

/** Tunable thresholds and switches. Everything here has a sensible default. */
export interface EngineConfig {
  /** Days without a logon before a user counts as stale. */
  staleDays: number
  /** Nesting depth above which a group is flagged. */
  deepNesting: number
  /** Max nested paths enumerated per user→privileged-group pair. */
  maxPrivilegedPaths: number
  /** Rule ids to skip. */
  disabled: FindingType[]
}

export const DEFAULT_CONFIG: EngineConfig = {
  staleDays: 90,
  deepNesting: 3,
  maxPrivilegedPaths: 8,
  disabled: []
}

/** A hygiene rule: pure function from a prebuilt context to findings. */
export interface Rule {
  id: FindingType
  /** Human name shown in rule lists and reports. */
  name: string
  severity: FindingSeverity
  /** One line on what the rule looks for. */
  describe: string
  /** Why an admin should care — the consequence, not the restated definition. */
  why: string
  detect(ctx: EngineContext): Finding[]
}

export function defineRule(rule: Rule): Rule {
  return rule
}
