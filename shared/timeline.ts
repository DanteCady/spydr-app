import { describeDiff, isUnchanged, type SnapshotDiff } from './diff'
import type { AppSettings } from './settings'
import type { DirectorySnapshot } from './types'

/**
 * The change timeline: one record per read that differed from the read before it.
 *
 * This is emphatically not an audit log. SPYDR sees the difference between two reads, so two
 * changes that cancel out in between are invisible, and it can never say who made a change or
 * exactly when. The domain controller's event log is the authority on both.
 */

/**
 * 'observed' is a real read. 'applied' is reserved for changes SPYDR makes itself. 'sample' is
 * invented data for the fictional domain, so it can never be mistaken for a record of anything.
 */
export type EntrySource = 'observed' | 'applied' | 'sample'

/**
 * What a read covered. Two reads are only comparable when these match — narrow the base DN or turn
 * off computers and an incomparable read would otherwise look like a mass deletion.
 */
export interface ReadScope {
  baseDn: string
  includeComputers: boolean
  includeContainers: boolean
}

export interface TimelineCounts {
  objectsAdded: number
  objectsRemoved: number
  objectsChanged: number
  membershipsAdded: number
  membershipsRemoved: number
  findingsOpened: number
  findingsClosed: number
}

export interface TimelineEntry {
  id: string
  domain: string
  readAt: string
  /** Which controller answered. Comparing reads from different DCs invites replication artefacts. */
  dcHost: string
  scope: ReadScope
  source: EntrySource
  counts: TimelineCounts
  scoreBefore: number
  scoreAfter: number
  summary: string
  /** Baselines have no previous read to compare against. */
  baseline: boolean
  /** The named detail. Encrypted at rest; absent from list results. */
  detail?: SnapshotDiff
}

export function readScope(snapshot: DirectorySnapshot, settings: AppSettings): ReadScope {
  return {
    baseDn: snapshot.baseDn,
    includeComputers: settings.connection.includeComputers,
    includeContainers: settings.connection.includeContainers
  }
}

export function sameScope(a: ReadScope, b: ReadScope): boolean {
  return (
    a.baseDn.toLowerCase() === b.baseDn.toLowerCase() &&
    a.includeComputers === b.includeComputers &&
    a.includeContainers === b.includeContainers
  )
}

export function countsOf(diff: SnapshotDiff): TimelineCounts {
  return {
    objectsAdded: diff.added.length,
    objectsRemoved: diff.removed.length,
    objectsChanged: diff.changed.length,
    membershipsAdded: diff.membershipsAdded.length,
    membershipsRemoved: diff.membershipsRemoved.length,
    findingsOpened: diff.findingsOpened.length,
    findingsClosed: diff.findingsClosed.length
  }
}

/** Every object the entry touches, for the index that answers "what happened to this object". */
export function touchedIds(diff: SnapshotDiff): { id: string; kind: string }[] {
  const out: { id: string; kind: string }[] = []
  for (const n of diff.added) out.push({ id: n.id, kind: 'added' })
  for (const n of diff.removed) out.push({ id: n.id, kind: 'removed' })
  for (const c of diff.changed) out.push({ id: c.id, kind: 'changed' })
  for (const m of diff.membershipsAdded) {
    out.push({ id: m.fromId, kind: 'joined' })
    out.push({ id: m.toId, kind: 'gained-member' })
  }
  for (const m of diff.membershipsRemoved) {
    out.push({ id: m.fromId, kind: 'left' })
    out.push({ id: m.toId, kind: 'lost-member' })
  }
  return out
}

export interface EntryInput {
  snapshot: DirectorySnapshot
  diff: SnapshotDiff | null
  scope: ReadScope
  source?: EntrySource
  id: string
  now?: Date
}

export function buildEntry({ snapshot, diff, scope, source = 'observed', id, now = new Date() }: EntryInput): TimelineEntry {
  const counts: TimelineCounts = diff
    ? countsOf(diff)
    : {
        objectsAdded: 0,
        objectsRemoved: 0,
        objectsChanged: 0,
        membershipsAdded: 0,
        membershipsRemoved: 0,
        findingsOpened: 0,
        findingsClosed: 0
      }
  return {
    id,
    domain: snapshot.domain,
    readAt: now.toISOString(),
    dcHost: snapshot.dcHost ?? '',
    scope,
    source,
    counts,
    scoreBefore: diff ? diff.scoreBefore : snapshot.stats.hygieneScore,
    scoreAfter: snapshot.stats.hygieneScore,
    summary: diff ? describeDiff(diff) : `First read of ${snapshot.domain} — ${snapshot.nodes.length} objects.`,
    baseline: diff === null,
    detail: diff ?? undefined
  }
}

/** Whether this read is worth recording at all. */
export function worthRecording(diff: SnapshotDiff | null): boolean {
  return diff === null || !isUnchanged(diff)
}
