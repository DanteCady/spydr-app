import { describe, expect, it } from 'vitest'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { diffSnapshots } from '../shared/diff'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { buildEntry, countsOf, readScope, sameScope, touchedIds, worthRecording } from '../shared/timeline'
import type { DirectorySnapshot } from '../shared/types'

const base = loadContosoFixture()
const clone = (): DirectorySnapshot => JSON.parse(JSON.stringify(base)) as DirectorySnapshot

describe('readScope', () => {
  it('treats a narrowed base DN as a different scope', () => {
    const wide = readScope(base, DEFAULT_SETTINGS)
    const narrow = readScope({ ...base, baseDn: 'OU=Corp,DC=contoso,DC=lab' }, DEFAULT_SETTINGS)
    expect(sameScope(wide, narrow)).toBe(false)
  })

  it('treats dropping computers as a different scope, so it cannot read as mass deletion', () => {
    const withComputers = readScope(base, DEFAULT_SETTINGS)
    const without = readScope(base, {
      ...DEFAULT_SETTINGS,
      connection: { ...DEFAULT_SETTINGS.connection, includeComputers: false }
    })
    expect(sameScope(withComputers, without)).toBe(false)
  })

  it('ignores case in the base DN, as LDAP does', () => {
    const a = readScope(base, DEFAULT_SETTINGS)
    const b = readScope({ ...base, baseDn: base.baseDn.toUpperCase() }, DEFAULT_SETTINGS)
    expect(sameScope(a, b)).toBe(true)
  })
})

describe('buildEntry', () => {
  const scope = readScope(base, DEFAULT_SETTINGS)

  it('records a first read as a baseline with no counts', () => {
    const entry = buildEntry({ snapshot: base, diff: null, scope, id: 'e1' })
    expect(entry.baseline).toBe(true)
    expect(entry.counts.objectsAdded).toBe(0)
    expect(entry.summary).toContain('First read')
    expect(entry.scoreBefore).toBe(entry.scoreAfter)
  })

  it('carries the controller and scope, so incomparable reads can be spotted later', () => {
    const entry = buildEntry({ snapshot: base, diff: null, scope, id: 'e1' })
    expect(entry.dcHost).toBe(base.dcHost)
    expect(entry.scope.baseDn).toBe(base.baseDn)
  })

  it('counts a real change and keeps the detail', () => {
    const after = clone()
    after.edges = after.edges.slice(1)
    const diff = diffSnapshots(base, after)
    const entry = buildEntry({ snapshot: after, diff, scope, id: 'e2' })
    expect(entry.baseline).toBe(false)
    expect(entry.counts.membershipsRemoved).toBe(1)
    expect(entry.detail?.membershipsRemoved).toHaveLength(1)
  })

  it('defaults to observed, leaving room for changes SPYDIR itself applies', () => {
    expect(buildEntry({ snapshot: base, diff: null, scope, id: 'e3' }).source).toBe('observed')
    expect(buildEntry({ snapshot: base, diff: null, scope, id: 'e4', source: 'applied' }).source).toBe('applied')
  })
})

describe('worthRecording', () => {
  it('records a baseline and a change, but not an identical re-read', () => {
    expect(worthRecording(null)).toBe(true)
    expect(worthRecording(diffSnapshots(base, clone()))).toBe(false)
    const after = clone()
    after.nodes = after.nodes.slice(1)
    expect(worthRecording(diffSnapshots(base, after))).toBe(true)
  })
})

describe('touchedIds', () => {
  it('indexes both ends of a membership change', () => {
    const after = clone()
    const dropped = after.edges[0]
    after.edges = after.edges.slice(1)
    const diff = diffSnapshots(base, after)
    const touched = touchedIds(diff)
    expect(touched).toContainEqual({ id: dropped.from, kind: 'left' })
    expect(touched).toContainEqual({ id: dropped.to, kind: 'lost-member' })
  })

  it('counts match the diff it came from', () => {
    const after = clone()
    after.nodes = after.nodes.slice(2)
    const diff = diffSnapshots(base, after)
    expect(countsOf(diff).objectsRemoved).toBe(2)
  })
})
