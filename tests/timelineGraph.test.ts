import { describe, expect, it } from 'vitest'
import { buildTimelineGraph, laneCount, scoreDirection, trackKey } from '../shared/timelineGraph'
import type { TimelineEntry } from '../shared/timeline'

function entry(over: Partial<TimelineEntry> & { id: string; readAt: string }): TimelineEntry {
  return {
    domain: 'corp.example.com',
    dcHost: 'dc01',
    scope: { baseDn: 'DC=corp,DC=example,DC=com', includeComputers: true, includeContainers: true },
    source: 'observed',
    counts: {
      objectsAdded: 0,
      objectsRemoved: 0,
      objectsChanged: 0,
      membershipsAdded: 0,
      membershipsRemoved: 0,
      findingsOpened: 0,
      findingsClosed: 0
    },
    scoreBefore: 50,
    scoreAfter: 50,
    summary: '',
    baseline: false,
    ...over
  }
}

// The store hands back newest first.
const newestFirst = (...rows: TimelineEntry[]): TimelineEntry[] => rows

describe('buildTimelineGraph', () => {
  it('puts one domain read one way into a single lane', () => {
    const rows = buildTimelineGraph(
      newestFirst(entry({ id: 'c', readAt: '2026-03-03' }), entry({ id: 'b', readAt: '2026-03-02' }), entry({ id: 'a', readAt: '2026-03-01' }))
    )
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0])
    expect(laneCount(rows)).toBe(1)
    expect(rows.at(-1)?.start).toBe(true)
    expect(rows[0].end).toBe(true)
  })

  it('opens a second lane for a second domain', () => {
    const rows = buildTimelineGraph(
      newestFirst(
        entry({ id: 'other', readAt: '2026-03-03', domain: 'lab.example.com' }),
        entry({ id: 'b', readAt: '2026-03-02' }),
        entry({ id: 'a', readAt: '2026-03-01' })
      )
    )
    expect(laneCount(rows)).toBe(2)
    expect(rows[0].lane).toBe(1)
    expect(rows[1].lane).toBe(0)
  })

  it('opens a lane when the scope narrows, because those reads are not comparable', () => {
    const narrowed = entry({
      id: 'narrow',
      readAt: '2026-03-03',
      scope: { baseDn: 'OU=Corp,DC=corp,DC=example,DC=com', includeComputers: true, includeContainers: true }
    })
    const rows = buildTimelineGraph(newestFirst(narrowed, entry({ id: 'a', readAt: '2026-03-01' })))
    expect(laneCount(rows)).toBe(2)
    expect(rows[0].start).toBe(true)
  })

  it('treats dropping computers as its own track', () => {
    const a = entry({ id: 'a', readAt: '2026-03-01' })
    const b = entry({
      id: 'b',
      readAt: '2026-03-02',
      scope: { ...a.scope, includeComputers: false }
    })
    expect(trackKey(a)).not.toBe(trackKey(b))
  })

  it('keeps a lane drawn through rows that belong to another track', () => {
    // corp, lab, corp — the corp lane must still have a line through the middle row.
    const rows = buildTimelineGraph(
      newestFirst(
        entry({ id: 'corp2', readAt: '2026-03-03' }),
        entry({ id: 'lab', readAt: '2026-03-02', domain: 'lab.example.com' }),
        entry({ id: 'corp1', readAt: '2026-03-01' })
      )
    )
    const middle = rows[1]
    expect(middle.entry.id).toBe('lab')
    expect(middle.active).toContain(0)
    expect(middle.active).toContain(1)
  })

  it('returns rows newest first, as it was given them', () => {
    const rows = buildTimelineGraph(
      newestFirst(entry({ id: 'c', readAt: '2026-03-03' }), entry({ id: 'a', readAt: '2026-03-01' }))
    )
    expect(rows.map((r) => r.entry.id)).toEqual(['c', 'a'])
  })
})

describe('scoreDirection', () => {
  it('reads the direction of travel', () => {
    expect(scoreDirection(entry({ id: 'x', readAt: '', scoreBefore: 40, scoreAfter: 56 }))).toBe('up')
    expect(scoreDirection(entry({ id: 'x', readAt: '', scoreBefore: 56, scoreAfter: 40 }))).toBe('down')
    expect(scoreDirection(entry({ id: 'x', readAt: '', scoreBefore: 50, scoreAfter: 50 }))).toBe('flat')
  })
})
