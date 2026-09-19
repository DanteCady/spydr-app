import Graph from 'graphology'
import type { DirectoryEdge, DirectoryNode, PathResult } from './types'

export type MembershipGraph = Graph<{ node: DirectoryNode }>

export function buildMembershipGraph(nodes: DirectoryNode[], edges: DirectoryEdge[]): MembershipGraph {
  const graph = new Graph<{ node: DirectoryNode }>({ type: 'directed', allowSelfLoops: true, multi: false })
  for (const node of nodes) {
    if (!graph.hasNode(node.id)) graph.addNode(node.id, { node })
  }
  for (const edge of edges) {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) continue
    if (!graph.hasDirectedEdge(edge.from, edge.to)) graph.addDirectedEdge(edge.from, edge.to)
  }
  return graph
}

export function groupIdSet(nodes: DirectoryNode[]): Set<string> {
  return new Set(nodes.filter((n) => n.type === 'group').map((n) => n.id))
}

export function findGroupCycles(graph: MembershipGraph, groups: Set<string>): string[][] {
  const cycles: string[][] = []
  const seen = new Set<string>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const keyOf = (cycle: string[]): string => {
    const min = [...cycle].sort()[0]
    const idx = cycle.indexOf(min)
    return [...cycle.slice(idx), ...cycle.slice(0, idx)].join('>')
  }

  const dfs = (id: string): void => {
    visiting.add(id)
    onStack.add(id)
    stack.push(id)
    for (const neighbor of graph.outNeighbors(id)) {
      if (!groups.has(neighbor)) continue
      if (!visiting.has(neighbor) && !visited.has(neighbor)) dfs(neighbor)
      else if (onStack.has(neighbor)) {
        const idx = stack.indexOf(neighbor)
        const cycle = stack.slice(idx)
        const k = keyOf(cycle)
        if (!seen.has(k)) {
          seen.add(k)
          cycles.push(cycle)
        }
      }
    }
    stack.pop()
    onStack.delete(id)
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of groups) {
    if (graph.hasNode(id) && !visited.has(id)) dfs(id)
  }
  return cycles
}

export function ancestorDepth(graph: MembershipGraph, groups: Set<string>, start: string, max = 32): number {
  let deepest = 0
  const walk = (id: string, depth: number, seen: Set<string>): void => {
    if (depth > deepest) deepest = depth
    if (depth >= max) return
    for (const parent of graph.outNeighbors(id)) {
      if (!groups.has(parent) || seen.has(parent)) continue
      const next = new Set(seen)
      next.add(parent)
      walk(parent, depth + 1, next)
    }
  }
  walk(start, 0, new Set([start]))
  return deepest
}

export function enumeratePaths(
  graph: MembershipGraph,
  sourceId: string,
  targetId: string,
  options: { maxDepth?: number; maxPaths?: number } = {}
): PathResult[] {
  const maxDepth = options.maxDepth ?? 8
  const maxPaths = options.maxPaths ?? 40
  const paths: PathResult[] = []
  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) return paths

  const label = (id: string): string => {
    const n = graph.getNodeAttribute(id, 'node')
    return n.displayName || n.name
  }

  const dfs = (id: string, trail: string[]): void => {
    if (paths.length >= maxPaths) return
    if (id === targetId && trail.length > 1) {
      paths.push({ nodeIds: [...trail], labels: trail.map(label) })
      return
    }
    if (trail.length > maxDepth) return
    for (const n of graph.outNeighbors(id)) {
      if (trail.includes(n)) continue
      trail.push(n)
      dfs(n, trail)
      trail.pop()
    }
  }

  dfs(sourceId, [sourceId])
  return paths
}

export function nodeById(nodes: DirectoryNode[]): Map<string, DirectoryNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

export function membersOf(edges: DirectoryEdge[], groupId: string): string[] {
  return edges.filter((e) => e.to === groupId).map((e) => e.from)
}

export function memberOf(edges: DirectoryEdge[], objectId: string): string[] {
  return edges.filter((e) => e.from === objectId).map((e) => e.to)
}

export function hopNeighborhood(graph: MembershipGraph, start: string): Set<string> {
  const found = new Set<string>([start])
  if (!graph.hasNode(start)) return found
  for (const n of graph.outNeighbors(start)) found.add(n)
  for (const n of graph.inNeighbors(start)) found.add(n)
  return found
}

export function membershipReach(
  graph: MembershipGraph,
  start: string,
  options: { direction: 'in' | 'out'; maxDepth?: number }
): Set<string> {
  const found = new Set<string>([start])
  if (!graph.hasNode(start)) return found
  const maxDepth = options.maxDepth ?? 8
  const queue: { id: string; depth: number }[] = [{ id: start, depth: 0 }]
  const seen = new Set([start])
  while (queue.length) {
    const step = queue.shift()
    if (!step || step.depth >= maxDepth) continue
    const { id, depth } = step
    const next = options.direction === 'out' ? graph.outNeighbors(id) : graph.inNeighbors(id)
    for (const n of next) {
      if (seen.has(n)) continue
      seen.add(n)
      found.add(n)
      queue.push({ id: n, depth: depth + 1 })
    }
  }
  return found
}

/** Parent groups (memberOf) plus nested members, without crossing a user's other groups. */
export function nestedMembership(graph: MembershipGraph, start: string, maxDepth = 8): Set<string> {
  const found = membershipReach(graph, start, { direction: 'out', maxDepth })
  for (const id of membershipReach(graph, start, { direction: 'in', maxDepth })) found.add(id)
  return found
}

/** An account that ends up inside a group, and how far away it sits. */
export interface EffectiveMember {
  id: string
  /** 1 means a direct member; anything higher arrives through that many nested groups. */
  depth: number
}

/**
 * Everyone who ends up inside a group, direct or nested. This is the question an access review
 * actually starts from — "who is really in Domain Admins?" — and it is not answerable from the
 * group's member list, because most of them are not in it.
 */
export function effectiveMembers(
  graph: MembershipGraph,
  groupId: string,
  options: { maxDepth?: number } = {}
): EffectiveMember[] {
  const out: EffectiveMember[] = []
  if (!graph.hasNode(groupId)) return out
  const maxDepth = options.maxDepth ?? 12
  const seen = new Set<string>([groupId])
  let frontier = [groupId]
  for (let depth = 1; depth <= maxDepth && frontier.length; depth += 1) {
    const next: string[] = []
    for (const id of frontier) {
      for (const member of graph.inNeighbors(id)) {
        if (seen.has(member)) continue
        seen.add(member)
        out.push({ id: member, depth })
        next.push(member)
      }
    }
    frontier = next
  }
  return out
}

/**
 * The links every path has in common. Cutting one of these breaks all of them at once, which is
 * the difference between revoking access and appearing to.
 */
export function sharedLinks(paths: PathResult[]): { from: string; to: string }[] {
  if (paths.length === 0) return []
  const keysOf = (path: PathResult): Set<string> => {
    const keys = new Set<string>()
    for (let i = 0; i < path.nodeIds.length - 1; i += 1) keys.add(`${path.nodeIds[i]}>${path.nodeIds[i + 1]}`)
    return keys
  }
  let common = keysOf(paths[0])
  for (const path of paths.slice(1)) {
    const keys = keysOf(path)
    common = new Set([...common].filter((k) => keys.has(k)))
    if (common.size === 0) break
  }
  // Ordered as they appear in the first path, so the nearest link to the account comes first.
  const first = paths[0]
  const links: { from: string; to: string }[] = []
  for (let i = 0; i < first.nodeIds.length - 1; i += 1) {
    const key = `${first.nodeIds[i]}>${first.nodeIds[i + 1]}`
    if (common.has(key)) links.push({ from: first.nodeIds[i], to: first.nodeIds[i + 1] })
  }
  return links
}
