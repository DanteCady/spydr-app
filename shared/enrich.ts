import { isPrivilegedSam } from './adFlags'
import { runEngine } from './engine/run'
import type { EngineConfig } from './engine/rule'
import type { HygieneSettings } from './settings'
import type { DirectoryEdge, DirectoryNode, DirectorySnapshot } from './types'

/** The hygiene settings, in the shape the engine takes. */
export function engineConfig(hygiene: HygieneSettings): Partial<EngineConfig> {
  return {
    staleDays: hygiene.staleDays,
    deepNesting: hygiene.deepNesting,
    maxPrivilegedPaths: hygiene.maxPrivilegedPaths,
    disabled: hygiene.disabledRules
  }
}

export function enrichSnapshot(
  partial: Omit<DirectorySnapshot, 'findings' | 'stats' | 'ingestedAt'> & { ingestedAt?: string },
  hygiene?: HygieneSettings
): DirectorySnapshot {
  const nodes = partial.nodes.map((n) => ({
    ...n,
    privileged: n.type === 'group' && isPrivilegedSam(n.sAMAccountName, hygiene?.privilegedGroups ?? [])
  }))
  const edges: DirectoryEdge[] = partial.edges
  const result = runEngine(nodes, edges, hygiene ? engineConfig(hygiene) : {})
  return {
    ...partial,
    nodes,
    edges,
    ingestedAt: partial.ingestedAt ?? new Date().toISOString(),
    findings: result.findings,
    stats: {
      users: nodes.filter((n) => n.type === 'user').length,
      groups: nodes.filter((n) => n.type === 'group').length,
      ous: nodes.filter((n) => n.type === 'ou' || n.type === 'container').length,
      computers: nodes.filter((n) => n.type === 'computer').length,
      edges: edges.length,
      findings: result.findings.length,
      hygieneScore: result.score
    }
  }
}

/**
 * Re-runs the rules over a snapshot already in memory. The engine is shared code, so changing a
 * threshold re-scores the open directory in the renderer without binding to the DC again.
 */
export function rescoreSnapshot(snapshot: DirectorySnapshot, hygiene: HygieneSettings): DirectorySnapshot {
  return enrichSnapshot({ ...snapshot, ingestedAt: snapshot.ingestedAt }, hygiene)
}

export function displayNode(node: DirectoryNode): string {
  return node.displayName || node.name || node.sAMAccountName
}
