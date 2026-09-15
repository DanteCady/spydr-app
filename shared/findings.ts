import { isDisabled, isDistributionGroup, isSecurityGroup, isStale } from './adFlags'
import {
  ancestorDepth,
  buildMembershipGraph,
  enumeratePaths,
  findGroupCycles,
  groupIdSet,
  type MembershipGraph
} from './graph'
import type { DirectoryEdge, DirectoryNode, Finding } from './types'

const DEEP_NESTING = 3

function label(nodes: Map<string, DirectoryNode>, id: string): string {
  return nodes.get(id)?.displayName || nodes.get(id)?.name || id
}

export function detectFindings(nodes: DirectoryNode[], edges: DirectoryEdge[]): Finding[] {
  const graph = buildMembershipGraph(nodes, edges)
  const groups = groupIdSet(nodes)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const privileged = nodes.filter((n) => n.type === 'group' && n.privileged)
  const findings: Finding[] = []

  findings.push(...circular(graph, groups, byId))
  findings.push(...deep(graph, groups, byId))
  findings.push(...emptySecurity(nodes, edges))
  findings.push(...disabledInGroup(nodes, edges, byId))
  findings.push(...staleInGroup(nodes, edges, byId))
  findings.push(...redundant(graph, groups, nodes, edges, byId))
  findings.push(...privilegedPaths(graph, nodes, privileged))
  findings.push(...distInSecurity(edges, byId))

  return findings
}

function circular(graph: MembershipGraph, groups: Set<string>, byId: Map<string, DirectoryNode>): Finding[] {
  return findGroupCycles(graph, groups).map((cycle, i) => ({
    id: `circular-${i}`,
    type: 'circular-nesting' as const,
    severity: 'critical' as const,
    title: 'Circular group nesting',
    objectIds: cycle,
    detail: cycle.map((id) => label(byId, id)).join(' → ') + ` → ${label(byId, cycle[0])}`,
    suggestedFix:
      'Break the loop in Active Directory Users and Computers: remove one nested member so the chain is a tree. Circular nesting makes effective membership unpredictable and can loop token evaluation.'
  }))
}

function deep(graph: MembershipGraph, groups: Set<string>, byId: Map<string, DirectoryNode>): Finding[] {
  const out: Finding[] = []
  for (const id of groups) {
    if (!graph.hasNode(id)) continue
    const depth = ancestorDepth(graph, groups, id)
    if (depth > DEEP_NESTING) {
      out.push({
        id: `deep-${id}`,
        type: 'deep-nesting',
        severity: 'high',
        title: `Nesting depth ${depth} (limit ${DEEP_NESTING})`,
        objectIds: [id],
        detail: `${label(byId, id)} sits ${depth} groups above its deepest nested member chain.`,
        suggestedFix:
          'Flatten the chain. Nesting more than three groups deep is hard to audit and often leftover from old role groups. Prefer one role group and direct members.'
      })
    }
  }
  return out
}

function emptySecurity(nodes: DirectoryNode[], edges: DirectoryEdge[]): Finding[] {
  const memberCounts = new Map<string, number>()
  for (const e of edges) memberCounts.set(e.to, (memberCounts.get(e.to) ?? 0) + 1)
  return nodes
    .filter((n) => n.type === 'group' && isSecurityGroup(n.groupType) && (memberCounts.get(n.id) ?? 0) === 0)
    .map((n) => ({
      id: `empty-${n.id}`,
      type: 'empty-security-group' as const,
      severity: 'low' as const,
      title: 'Empty security group',
      objectIds: [n.id],
      detail: `${n.displayName} is a security group with no members.`,
      suggestedFix:
        'If unused, document and delete it after checking delegated ACLs and file shares. Empty groups linger and get reused by mistake.'
    }))
}

function disabledInGroup(nodes: DirectoryNode[], edges: DirectoryEdge[], byId: Map<string, DirectoryNode>): Finding[] {
  const groupIds = new Set(nodes.filter((n) => n.type === 'group').map((n) => n.id))
  const out: Finding[] = []
  for (const n of nodes) {
    if (n.type !== 'user' || !isDisabled(n.userAccountControl)) continue
    const groups = edges.filter((e) => e.from === n.id && e.via === 'member' && groupIds.has(e.to))
    if (groups.length === 0) continue
    out.push({
      id: `disabled-${n.id}`,
      type: 'disabled-in-group',
      severity: 'medium',
      title: 'Disabled user still in groups',
      objectIds: [n.id, ...groups.map((e) => e.to)],
      detail: `${n.displayName} is disabled but remains in ${groups.map((e) => label(byId, e.to)).join(', ')}.`,
      suggestedFix:
        'Remove the disabled account from application and role groups (leave Domain Users). Disabled members still appear in nested token expansion and confuse access reviews.'
    })
  }
  return out
}

function staleInGroup(nodes: DirectoryNode[], edges: DirectoryEdge[], byId: Map<string, DirectoryNode>): Finding[] {
  const groupIds = new Set(nodes.filter((n) => n.type === 'group').map((n) => n.id))
  const out: Finding[] = []
  for (const n of nodes) {
    if (n.type !== 'user' || isDisabled(n.userAccountControl) || !isStale(n.lastLogonTimestamp)) continue
    const groups = edges.filter((e) => e.from === n.id && e.via === 'member' && groupIds.has(e.to))
    if (groups.length === 0) continue
    out.push({
      id: `stale-${n.id}`,
      type: 'stale-in-group',
      severity: 'medium',
      title: 'Stale user still in groups',
      objectIds: [n.id, ...groups.map((e) => e.to)],
      detail: `${n.displayName} has no logon in 90+ days (or never) and is still in ${groups.map((e) => label(byId, e.to)).join(', ')}.`,
      suggestedFix:
        'Confirm the account is unused, then disable it and strip role-group membership. Stale members are a common source of leftover access in small directories.'
    })
  }
  return out
}

function redundant(
  graph: MembershipGraph,
  groups: Set<string>,
  nodes: DirectoryNode[],
  edges: DirectoryEdge[],
  byId: Map<string, DirectoryNode>
): Finding[] {
  const out: Finding[] = []
  const users = nodes.filter((n) => n.type === 'user')
  for (const user of users) {
    const direct = edges.filter((e) => e.from === user.id).map((e) => e.to)
    const directSet = new Set(direct)
    for (const g of direct) {
      if (!groups.has(g) || !graph.hasNode(g)) continue
      for (const nested of graph.inNeighbors(g)) {
        if (!groups.has(nested) || nested === g) continue
        if (directSet.has(nested)) {
          out.push({
            id: `redundant-${user.id}-${g}-${nested}`,
            type: 'redundant-membership',
            severity: 'low',
            title: 'Redundant direct membership',
            objectIds: [user.id, nested, g],
            detail: `${user.displayName} is a direct member of ${label(byId, g)} and of nested group ${label(byId, nested)}.`,
            suggestedFix: `Remove the user from the parent (${label(byId, g)}) or from the nested group — not both. Keep the membership that matches the actual role.`
          })
        }
      }
    }
  }
  return out
}

function privilegedPaths(
  graph: MembershipGraph,
  nodes: DirectoryNode[],
  privileged: DirectoryNode[]
): Finding[] {
  const out: Finding[] = []
  const users = nodes.filter((n) => n.type === 'user')
  for (const user of users) {
    for (const g of privileged) {
      const paths = enumeratePaths(graph, user.id, g.id, { maxDepth: 8, maxPaths: 8 })
      const nested = paths.filter((p) => p.nodeIds.length > 2)
      if (nested.length === 0) continue
      out.push({
        id: `priv-${user.id}-${g.id}`,
        type: 'privileged-nested-path',
        severity: 'critical',
        title: `Nested path to ${g.sAMAccountName}`,
        objectIds: [...new Set(nested.flatMap((p) => p.nodeIds))],
        detail: nested.map((p) => p.labels.join(' → ')).join(' | '),
        suggestedFix: `Review why ${user.displayName} reaches ${g.displayName} through nested groups. Privileged groups should have direct, named members only.`
      })
    }
  }
  return out
}

function distInSecurity(edges: DirectoryEdge[], byId: Map<string, DirectoryNode>): Finding[] {
  const out: Finding[] = []
  for (const edge of edges) {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (!from || !to) continue
    if (from.type !== 'group' || to.type !== 'group') continue
    if (isDistributionGroup(from.groupType) && isSecurityGroup(to.groupType)) {
      out.push({
        id: `distsec-${from.id}-${to.id}`,
        type: 'distribution-in-security',
        severity: 'high',
        title: 'Distribution group nested in a security group',
        objectIds: [from.id, to.id],
        detail: `${from.displayName} (distribution) is a member of ${to.displayName} (security).`,
        suggestedFix:
          'Do not nest distribution groups into security groups. Mail-enabled dist groups are not meant to grant access. Create a security group for the role and keep the dist group for email only.'
      })
    }
  }
  return out
}
