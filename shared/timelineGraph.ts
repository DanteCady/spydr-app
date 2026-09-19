import type { TimelineEntry } from './timeline'

/**
 * Lanes for the timeline graph.
 *
 * There is no branching in the git sense — nothing merges, and history is not rewritten. What does
 * run in parallel is tracks: a track is one domain read under one scope. Reading a second domain,
 * or narrowing the base DN so that reads stop being comparable, starts a new track beside the old
 * one, which is exactly the thing a lane makes visible.
 */

export interface GraphRow {
  entry: TimelineEntry
  /** Which lane this read sits in. */
  lane: number
  /** Lanes that have a line running through this row, for drawing the rail. */
  active: number[]
  /** The first read of its track — where the lane begins. */
  start: boolean
  /** The last read of its track — where the lane ends. */
  end: boolean
}

export function trackKey(entry: TimelineEntry): string {
  return [
    entry.domain.toLowerCase(),
    entry.scope.baseDn.toLowerCase(),
    entry.scope.includeComputers ? 'c' : '-',
    entry.scope.includeContainers ? 'n' : '-'
  ].join('|')
}

/** How a read moved the score, which is what colours its node. */
export function scoreDirection(entry: TimelineEntry): 'up' | 'down' | 'flat' {
  if (entry.scoreAfter > entry.scoreBefore) return 'up'
  if (entry.scoreAfter < entry.scoreBefore) return 'down'
  return 'flat'
}

/**
 * Takes entries newest first, as the store returns them, and returns rows in the same order with
 * lane assignments computed oldest first — a lane belongs to the track that opened it earliest.
 */
export function buildTimelineGraph(entries: TimelineEntry[]): GraphRow[] {
  const oldestFirst = [...entries].reverse()
  const laneOf = new Map<string, number>()
  const firstIndex = new Map<string, number>()
  const lastIndex = new Map<string, number>()

  oldestFirst.forEach((entry, i) => {
    const key = trackKey(entry)
    if (!laneOf.has(key)) {
      laneOf.set(key, laneOf.size)
      firstIndex.set(key, i)
    }
    lastIndex.set(key, i)
  })

  const rows: GraphRow[] = oldestFirst.map((entry, i) => {
    const key = trackKey(entry)
    const active: number[] = []
    for (const [otherKey, lane] of laneOf) {
      if ((firstIndex.get(otherKey) ?? 0) <= i && i <= (lastIndex.get(otherKey) ?? 0)) active.push(lane)
    }
    return {
      entry,
      lane: laneOf.get(key) ?? 0,
      active: active.sort((a, b) => a - b),
      start: firstIndex.get(key) === i,
      end: lastIndex.get(key) === i
    }
  })

  return rows.reverse()
}

export function laneCount(rows: GraphRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.lane + 1, ...row.active.map((l) => l + 1)), 1)
}
