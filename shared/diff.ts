import type { DirectoryEdge, DirectoryNode, DirectorySnapshot, Finding } from './types'

/**
 * What changed between two reads of the same directory. Objects are matched by objectGUID, so a
 * rename or an OU move is a change to one object rather than a deletion and an addition.
 */

export interface MembershipChange {
  fromId: string
  fromName: string
  toId: string
  toName: string
  via: DirectoryEdge['via']
}

export interface ObjectChange {
  id: string
  name: string
  /** Human-readable, e.g. "renamed from Bob Martin", "disabled", "moved to OU=Leavers". */
  changes: string[]
}

export interface SnapshotDiff {
  added: DirectoryNode[]
  removed: DirectoryNode[]
  changed: ObjectChange[]
  membershipsAdded: MembershipChange[]
  membershipsRemoved: MembershipChange[]
  findingsOpened: Finding[]
  findingsClosed: Finding[]
  findingsBefore: number
  findingsAfter: number
  scoreBefore: number
  scoreAfter: number
}

const edgeKey = (e: DirectoryEdge): string => `${e.from}>${e.to}:${e.via}`

function nameOf(byId: Map<string, DirectoryNode>, id: string): string {
  const node = byId.get(id)
  return node ? node.displayName || node.sAMAccountName || node.name : id
}

/** Attribute movement worth reporting, in words rather than field names. */
function describeMove(before: DirectoryNode, after: DirectoryNode): string[] {
  const out: string[] = []
  if (before.displayName !== after.displayName) out.push(`renamed from ${before.displayName}`)
  if (before.description !== after.description) out.push('description changed')
  if (before.dn !== after.dn && before.parentDn !== after.parentDn) out.push(`moved to ${after.parentDn ?? 'the domain root'}`)
  if (before.userAccountControl !== after.userAccountControl) {
    const wasDisabled = ((before.userAccountControl ?? 0) & 2) !== 0
    const isDisabled = ((after.userAccountControl ?? 0) & 2) !== 0
    if (wasDisabled !== isDisabled) out.push(isDisabled ? 'disabled' : 'enabled')
    else out.push('account flags changed')
  }
  return out
}

export function diffSnapshots(before: DirectorySnapshot, after: DirectorySnapshot): SnapshotDiff {
  const beforeById = new Map(before.nodes.map((n) => [n.id, n] as const))
  const afterById = new Map(after.nodes.map((n) => [n.id, n] as const))
  const allById = new Map([...beforeById, ...afterById])

  const added = after.nodes.filter((n) => !beforeById.has(n.id))
  const removed = before.nodes.filter((n) => !afterById.has(n.id))

  const changed: ObjectChange[] = []
  for (const [id, prev] of beforeById) {
    const next = afterById.get(id)
    if (!next) continue
    const changes = describeMove(prev, next)
    if (changes.length) changed.push({ id, name: next.displayName || next.name, changes })
  }

  const beforeEdges = new Map(before.edges.map((e) => [edgeKey(e), e] as const))
  const afterEdges = new Map(after.edges.map((e) => [edgeKey(e), e] as const))
  const toChange = (e: DirectoryEdge): MembershipChange => ({
    fromId: e.from,
    fromName: nameOf(allById, e.from),
    toId: e.to,
    toName: nameOf(allById, e.to),
    via: e.via
  })
  const membershipsAdded: MembershipChange[] = []
  const membershipsRemoved: MembershipChange[] = []
  for (const [key, edge] of afterEdges) if (!beforeEdges.has(key)) membershipsAdded.push(toChange(edge))
  for (const [key, edge] of beforeEdges) if (!afterEdges.has(key)) membershipsRemoved.push(toChange(edge))

  const beforeFindings = new Set(before.findings.map((f) => f.id))
  const afterFindings = new Set(after.findings.map((f) => f.id))

  return {
    added,
    removed,
    changed,
    membershipsAdded,
    membershipsRemoved,
    findingsOpened: after.findings.filter((f) => !beforeFindings.has(f.id)),
    findingsClosed: before.findings.filter((f) => !afterFindings.has(f.id)),
    findingsBefore: before.findings.length,
    findingsAfter: after.findings.length,
    scoreBefore: before.stats.hygieneScore,
    scoreAfter: after.stats.hygieneScore
  }
}

/** True when nothing at all moved, which is a result worth reporting in its own right. */
export function isUnchanged(diff: SnapshotDiff): boolean {
  return (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.changed.length === 0 &&
    diff.membershipsAdded.length === 0 &&
    diff.membershipsRemoved.length === 0 &&
    diff.findingsOpened.length === 0 &&
    diff.findingsClosed.length === 0
  )
}

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** One line an admin can read at a glance. */
export function describeDiff(diff: SnapshotDiff): string {
  if (isUnchanged(diff)) return 'Nothing changed since the last read.'
  const parts: string[] = []
  if (diff.added.length) parts.push(`${count(diff.added.length, 'object')} added`)
  if (diff.removed.length) parts.push(`${count(diff.removed.length, 'object')} removed`)
  if (diff.changed.length) parts.push(`${count(diff.changed.length, 'object')} changed`)
  if (diff.membershipsAdded.length) parts.push(`${count(diff.membershipsAdded.length, 'membership')} added`)
  if (diff.membershipsRemoved.length) parts.push(`${count(diff.membershipsRemoved.length, 'membership')} removed`)
  if (diff.findingsBefore !== diff.findingsAfter) parts.push(`findings ${diff.findingsBefore} → ${diff.findingsAfter}`)
  const score = diff.scoreBefore === diff.scoreAfter ? '' : ` · score ${diff.scoreBefore} → ${diff.scoreAfter}`
  return `${parts.join(', ')}${score}`
}
