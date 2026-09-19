import type { DirectoryNode, DirectorySnapshot } from './types'

/**
 * What changed between two reads of the same directory. Used to tell an admin what a re-crawl
 * picked up, and the basis for comparing two snapshots properly later.
 */
export interface SnapshotDiff {
  added: DirectoryNode[]
  removed: DirectoryNode[]
  /** Objects whose name, description, or account flags moved. */
  changed: { before: DirectoryNode; after: DirectoryNode }[]
  edgesAdded: number
  edgesRemoved: number
  findingsBefore: number
  findingsAfter: number
  scoreBefore: number
  scoreAfter: number
}

const edgeKey = (e: { from: string; to: string; via: string }): string => `${e.from}>${e.to}:${e.via}`

function moved(before: DirectoryNode, after: DirectoryNode): boolean {
  return (
    before.displayName !== after.displayName ||
    before.description !== after.description ||
    before.userAccountControl !== after.userAccountControl ||
    before.dn !== after.dn
  )
}

export function diffSnapshots(before: DirectorySnapshot, after: DirectorySnapshot): SnapshotDiff {
  const beforeById = new Map(before.nodes.map((n) => [n.id, n] as const))
  const afterById = new Map(after.nodes.map((n) => [n.id, n] as const))

  const added = after.nodes.filter((n) => !beforeById.has(n.id))
  const removed = before.nodes.filter((n) => !afterById.has(n.id))
  const changed: SnapshotDiff['changed'] = []
  for (const [id, prev] of beforeById) {
    const next = afterById.get(id)
    if (next && moved(prev, next)) changed.push({ before: prev, after: next })
  }

  const beforeEdges = new Set(before.edges.map(edgeKey))
  const afterEdges = new Set(after.edges.map(edgeKey))
  let edgesAdded = 0
  let edgesRemoved = 0
  for (const key of afterEdges) if (!beforeEdges.has(key)) edgesAdded += 1
  for (const key of beforeEdges) if (!afterEdges.has(key)) edgesRemoved += 1

  return {
    added,
    removed,
    changed,
    edgesAdded,
    edgesRemoved,
    findingsBefore: before.findings.length,
    findingsAfter: after.findings.length,
    scoreBefore: before.stats.hygieneScore,
    scoreAfter: after.stats.hygieneScore
  }
}

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** One line an admin can read at a glance, or a plain "nothing changed". */
export function describeDiff(diff: SnapshotDiff): string {
  const parts: string[] = []
  if (diff.added.length) parts.push(`${count(diff.added.length, 'object')} added`)
  if (diff.removed.length) parts.push(`${count(diff.removed.length, 'object')} removed`)
  if (diff.changed.length) parts.push(`${count(diff.changed.length, 'object')} changed`)
  if (diff.edgesAdded) parts.push(`${count(diff.edgesAdded, 'membership')} added`)
  if (diff.edgesRemoved) parts.push(`${count(diff.edgesRemoved, 'membership')} removed`)
  if (diff.findingsBefore !== diff.findingsAfter) {
    parts.push(`findings ${diff.findingsBefore} → ${diff.findingsAfter}`)
  }
  if (parts.length === 0) return 'Nothing changed since the last read.'
  const score =
    diff.scoreBefore === diff.scoreAfter ? '' : ` · score ${diff.scoreBefore} → ${diff.scoreAfter}`
  return `${parts.join(', ')}${score}`
}
