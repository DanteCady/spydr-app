import { isBuiltinAccount, isBuiltinGroup, isDisabled, isDistributionGroup, isSecurityGroup } from '../adFlags'
import { ancestorDepth, buildMembershipGraph, findGroupCycles, groupIdSet, type MembershipGraph } from '../graph'
import type { DirectoryEdge, DirectoryNode } from '../types'
import type { EngineConfig } from './rule'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Everything a rule might want, computed once per run so rules are lookups, not walks.
 * Building this is the only O(graph) work in the engine.
 */
export interface EngineContext {
  config: EngineConfig
  now: number
  nodes: DirectoryNode[]
  edges: DirectoryEdge[]
  byId: Map<string, DirectoryNode>
  graph: MembershipGraph
  groups: Set<string>
  users: DirectoryNode[]
  privileged: DirectoryNode[]
  /** Direct members of a group (any edge kind). */
  membersOf: Map<string, string[]>
  /** Groups an object is a direct member of (any edge kind). */
  memberOf: Map<string, string[]>
  /** Explicit `member` edges leaving a node, to groups only. */
  memberEdgesToGroups: Map<string, DirectoryEdge[]>
  cycles: string[][]
  inCycle: Set<string>
  /** Nesting depth per group: how many groups sit above it in its longest chain. */
  depth: Map<string, number>
  label(id: string): string
  isStale(lastLogonTimestamp: number | null | undefined): boolean
  isDisabled(node: DirectoryNode): boolean
  isSecurityGroup(node: DirectoryNode): boolean
  isDistributionGroup(node: DirectoryNode): boolean
  /** Created by AD itself: skipped by cleanup rules, never by privilege rules. */
  isBuiltin(node: DirectoryNode): boolean
}

export function buildContext(
  nodes: DirectoryNode[],
  edges: DirectoryEdge[],
  config: EngineConfig,
  now = Date.now()
): EngineContext {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const graph = buildMembershipGraph(nodes, edges)
  const groups = groupIdSet(nodes)
  const users = nodes.filter((n) => n.type === 'user')
  const privileged = nodes.filter((n) => n.type === 'group' && n.privileged)

  const membersOf = new Map<string, string[]>()
  const memberOf = new Map<string, string[]>()
  const memberEdgesToGroups = new Map<string, DirectoryEdge[]>()
  for (const e of edges) {
    membersOf.set(e.to, [...(membersOf.get(e.to) ?? []), e.from])
    memberOf.set(e.from, [...(memberOf.get(e.from) ?? []), e.to])
    if (e.via === 'member' && groups.has(e.to)) {
      memberEdgesToGroups.set(e.from, [...(memberEdgesToGroups.get(e.from) ?? []), e])
    }
  }

  const cycles = findGroupCycles(graph, groups)
  const inCycle = new Set(cycles.flat())
  const depth = new Map<string, number>()
  for (const id of groups) if (graph.hasNode(id)) depth.set(id, ancestorDepth(graph, groups, id))

  const staleMs = config.staleDays * DAY_MS
  return {
    config,
    now,
    nodes,
    edges,
    byId,
    graph,
    groups,
    users,
    privileged,
    membersOf,
    memberOf,
    memberEdgesToGroups,
    cycles,
    inCycle,
    depth,
    label: (id) => byId.get(id)?.displayName || byId.get(id)?.name || id,
    isStale: (ts) => ts == null || ts === 0 || now - ts > staleMs,
    isDisabled: (n) => isDisabled(n.userAccountControl),
    isSecurityGroup: (n) => isSecurityGroup(n.groupType),
    isDistributionGroup: (n) => isDistributionGroup(n.groupType),
    isBuiltin: (n) =>
      n.type === 'group' ? isBuiltinGroup(n.sAMAccountName, n.dn) : isBuiltinAccount(n.sAMAccountName)
  }
}
