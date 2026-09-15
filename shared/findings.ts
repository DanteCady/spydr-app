import { runEngine } from './engine/run'
import type { DirectoryEdge, DirectoryNode, Finding } from './types'

/** Compatibility wrapper: the rule engine in ./engine is the implementation. */
export function detectFindings(nodes: DirectoryNode[], edges: DirectoryEdge[]): Finding[] {
  return runEngine(nodes, edges).findings
}
