import { isPrivilegedSam } from './adFlags'
import { runEngine } from './engine/run'
import type { DirectoryEdge, DirectoryNode, DirectorySnapshot } from './types'

export function enrichSnapshot(partial: Omit<DirectorySnapshot, 'findings' | 'stats' | 'ingestedAt'> & { ingestedAt?: string }): DirectorySnapshot {
  const nodes = partial.nodes.map((n) => ({
    ...n,
    privileged: n.type === 'group' && isPrivilegedSam(n.sAMAccountName)
  }))
  const edges: DirectoryEdge[] = partial.edges
  const result = runEngine(nodes, edges)
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

export function displayNode(node: DirectoryNode): string {
  return node.displayName || node.name || node.sAMAccountName
}
