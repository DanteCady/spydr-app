import type { DirectoryEdge, DirectoryNode, Finding, FindingSeverity } from '../types'
import { buildContext } from './context'
import { RULES } from './registry'
import { DEFAULT_CONFIG, type EngineConfig } from './rule'

export interface EngineFacts {
  rulesRun: number
  cycles: number
  deepestNesting: number
  privilegedGroups: number
}

export interface EngineResult {
  findings: Finding[]
  /** 0–100; 100 means no findings. Weighted by severity and floored at 0. */
  score: number
  facts: EngineFacts
}

const WEIGHT: Record<FindingSeverity, number> = { critical: 12, high: 6, medium: 3, low: 1 }

/** Penalty at which a directory scores 50. Tuned so a typical messy domain lands mid-range. */
const HALF_LIFE = 100

/**
 * 0–100, where 100 is a clean directory. The curve saturates rather than subtracting, because a
 * linear penalty hits zero on any real domain and stops being informative — this stays strictly
 * monotonic, so fixing anything always moves the number up.
 */
export function hygieneScore(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => sum + WEIGHT[f.severity], 0)
  return Math.round((100 * HALF_LIFE) / (HALF_LIFE + penalty))
}

export function runEngine(
  nodes: DirectoryNode[],
  edges: DirectoryEdge[],
  config: Partial<EngineConfig> = {},
  now = Date.now()
): EngineResult {
  const cfg: EngineConfig = { ...DEFAULT_CONFIG, ...config }
  const ctx = buildContext(nodes, edges, cfg, now)
  const disabled = new Set(cfg.disabled)
  const active = RULES.filter((r) => !disabled.has(r.id))
  const findings = active.flatMap((r) => r.detect(ctx))
  return {
    findings,
    score: hygieneScore(findings),
    facts: {
      rulesRun: active.length,
      cycles: ctx.cycles.length,
      deepestNesting: Math.max(0, ...ctx.depth.values()),
      privilegedGroups: ctx.privileged.length
    }
  }
}

export { DEFAULT_CONFIG, RULES }
export type { EngineConfig }
